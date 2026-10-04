import { useState, type FormEvent, type ReactNode } from "react"
import { Download, Pencil, Plus, Search, Trash, X } from "lucide-react"
import { api, fieldMessages, toApiError, type ApiError } from "@/api/client"
import { useApi } from "@/api/useApi"
import { ErrorMessage } from "./ErrorMessage"

type Value = string | number | boolean | null | number[]
export type Row = { id: number; [key: string]: any }
export type Option = { value: Value; label: string }

export interface Field {
  name: string
  label: string
  type?: "text" | "number" | "date" | "time" | "textarea" | "checkbox" | "select" | "multiselect"
  options?: Option[]
  default?: Value
  render?: (row: Row) => ReactNode // своя ячейка таблицы
  inTable?: boolean // false — только в форме
  inForm?: boolean // false — только в таблице
}

interface Props {
  title: string
  endpoint: string // DRF ModelViewSet: GET/POST на endpoint, PATCH/DELETE на endpoint + id/
  fields: Field[]
  canCreate?: boolean
  canDelete?: boolean
  rowClass?: (row: Row) => string
}

export const INPUT =
  "w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"

/** Скачать таблицу как CSV. ";" и BOM — чтобы русский Excel разложил по колонкам и не сломал кириллицу */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = /^\d+\.\d+$/.test(String(v)) ? String(v).replace(".", ",") : String(v) // 4500.00 -> 4500,00: число для русского Excel
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s // иначе Excel выполнит значение как формулу
    return `"${safe.replace(/"/g, '""')}"`
  }
  const csv = rows.map((r) => r.map(cell).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
  Object.assign(document.createElement("a"), { href: url, download: filename }).click()
  setTimeout(() => URL.revokeObjectURL(url))
}

export const exportButton = (onClick: () => void, disabled: boolean) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title="Скачать CSV"
    className="flex items-center gap-2 px-4 py-2 rounded-full border border-rose-200 bg-white text-sm font-medium text-muted-foreground hover:text-gold hover:border-gold transition-colors disabled:opacity-50 disabled:pointer-events-none"
  >
    <Download className="size-4" /> CSV
  </button>
)

const labelOf = (f: Field, v: unknown) => f.options?.find((o) => o.value === v)?.label ?? ""

/** Значение поля текстом: для ячейки и поиска */
function text(f: Field, row: Row): string {
  const v = row[f.name]
  if (f.type === "select") return labelOf(f, v)
  if (f.type === "multiselect") return (v as number[]).map((id) => labelOf(f, id)).join(", ")
  if (f.type === "checkbox") return v ? "Да" : "Нет"
  if (f.type === "time" && v) return String(v).slice(0, 5)
  return v == null ? "" : String(v)
}

/** Значение для сортировки: числа числом, списки по подписи, пустые — null */
function sortValue(f: Field, row: Row): string | number | null {
  if (f.type === "select" || f.type === "multiselect") return text(f, row).toLowerCase() || null
  const v = row[f.name]
  if (v == null || v === "") return null
  if (typeof v !== "string") return Number(v)
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v.toLowerCase()
}

function compare(a: string | number | null, b: string | number | null, desc: boolean) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1 // пустые всегда в конце
  const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ru")
  return desc ? -r : r
}

function emptyValue(f: Field): Value {
  if (f.default !== undefined) return f.default
  if (f.type === "checkbox") return false
  if (f.type === "multiselect") return []
  if (f.type === "select") return f.options?.[0]?.value ?? null
  return ""
}

export function CrudTable({ title, endpoint, fields, canCreate = true, canDelete = true, rowClass }: Props) {
  const { data, loading, error, reload } = useApi(() => api<Row[]>(endpoint), [endpoint])
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{ name: string; desc: boolean } | null>(null)
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [values, setValues] = useState<Record<string, Value>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<ApiError | null>(null)

  const columns = fields.filter((f) => f.inTable !== false)
  const formFields = fields.filter((f) => f.inForm !== false)
  const q = query.trim().toLowerCase()
  // телефон в любом формате: "999 123" и "8 999 123" найдут "+7 (999) 123-45-67"
  const phoneQuery = /^[\d\s()+-]+$/.test(q) ? q.replace(/\D/g, "") : ""
  const phoneVariants = [phoneQuery, phoneQuery.replace(/^8/, "7")]
  const matches = (row: Row) =>
    fields.map((f) => text(f, row)).join(" ").toLowerCase().includes(q) ||
    (phoneQuery.length >= 3 &&
      fields.some((f) => phoneVariants.some((v) => text(f, row).replace(/\D/g, "").includes(v))))
  const rows = (data ?? []).filter((row) => !q || matches(row))
  const sortField = fields.find((f) => f.name === sort?.name)
  if (sort && sortField) rows.sort((a, b) => compare(sortValue(sortField, a), sortValue(sortField, b), sort.desc))
  const toggleSort = (name: string) => setSort(sort?.name === name ? { name, desc: !sort.desc } : { name, desc: false })

  const open = (row: Row | "new") => {
    setEditing(row)
    setErrors({})
    setFormError(null)
    setValues(
      Object.fromEntries(
        formFields.map((f) => {
          if (row === "new") return [f.name, emptyValue(f)]
          const v = row[f.name]
          if (f.type === "time" && v) return [f.name, String(v).slice(0, 5)]
          return [f.name, f.type === "select" ? v : (v ?? emptyValue(f))]
        }),
      ),
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing === "new") await api(endpoint, { method: "POST", body: values })
      else await api(`${endpoint}${editing.id}/`, { method: "PATCH", body: values })
      setEditing(null)
      reload()
    } catch (err) {
      const apiError = toApiError(err)
      const fieldErrors = fieldMessages(apiError)
      setErrors(fieldErrors)
      if (!formFields.some((f) => fieldErrors[f.name])) setFormError(apiError.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: Row) => {
    if (!confirm("Удалить запись? Это действие нельзя отменить.")) return
    setListError(null)
    try {
      await api(`${endpoint}${row.id}/`, { method: "DELETE" })
      reload()
    } catch (err) {
      setListError(toApiError(err))
    }
  }

  const input = (f: Field) => {
    const v = values[f.name]
    const set = (next: Value) => {
      setValues({ ...values, [f.name]: next })
      if (errors[f.name]) setErrors({ ...errors, [f.name]: "" })
    }
    const id = `crud-${f.name}`
    switch (f.type) {
      case "textarea":
        return <textarea id={id} rows={3} value={String(v ?? "")} onChange={(e) => set(e.target.value)} className={INPUT} />
      case "checkbox":
        return (
          <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e) => set(e.target.checked)} className="size-5 accent-gold" />
        )
      case "select":
        return (
          <select
            id={id}
            value={String(v)}
            onChange={(e) => set(f.options!.find((o) => String(o.value) === e.target.value)!.value)}
            className={INPUT}
          >
            {f.options!.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        )
      case "multiselect": {
        const selected = (v as number[]) ?? []
        return (
          <div className="grid grid-cols-2 gap-2">
            {f.options!.map((o) => (
              <label key={String(o.value)} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-gold"
                  checked={selected.includes(o.value as number)}
                  onChange={(e) =>
                    set(e.target.checked ? [...selected, o.value as number] : selected.filter((x) => x !== o.value))
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        )
      }
      default:
        return <input id={id} type={f.type ?? "text"} value={String(v ?? "")} onChange={(e) => set(e.target.value)} className={INPUT} />
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-serif text-foreground">
          {title}
          {data && <span className="ml-3 text-base font-sans text-muted-foreground">{data.length}</span>}
        </h1>
        <div className="flex items-center gap-3">
          <label className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              aria-label="Поиск"
              className="pl-9 pr-4 py-2 rounded-full border border-rose-200 bg-white text-sm focus:outline-none focus:border-gold"
            />
          </label>
          {exportButton(
            () => downloadCsv(`${title}.csv`, [fields.map((f) => f.label), ...rows.map((row) => fields.map((f) => text(f, row)))]),
            rows.length === 0,
          )}
          {canCreate && (
            <button
              onClick={() => open("new")}
              className="flex items-center gap-2 bg-gold hover:bg-gold-hover text-white px-5 py-2 rounded-full text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="size-4" /> Добавить
            </button>
          )}
        </div>
      </div>

      {loading && !data && <p className="text-muted-foreground">Загрузка…</p>}
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {listError && <ErrorMessage error={listError} />}
      {data && rows.length === 0 && <p className="text-muted-foreground">{q ? "Ничего не найдено." : "Пока пусто."}</p>}

      {rows.length > 0 && (
        <div className="bg-white rounded-3xl border border-rose-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-rose-50 text-muted-foreground text-left">
              <tr>
                {columns.map((f) => (
                  <th
                    key={f.name}
                    aria-sort={sort?.name === f.name ? (sort.desc ? "descending" : "ascending") : undefined}
                    className="p-4 font-medium whitespace-nowrap"
                  >
                    <button onClick={() => toggleSort(f.name)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      {f.label}
                      <span className="w-3 text-gold">{sort?.name === f.name && (sort.desc ? "↓" : "↑")}</span>
                    </button>
                  </th>
                ))}
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`border-t border-rose-50 hover:bg-rose-50/40 transition-colors ${rowClass?.(row) ?? ""}`}>
                  {columns.map((f) => (
                    <td key={f.name} className="p-4 align-top">
                      {f.render ? f.render(row) : text(f, row)}
                    </td>
                  ))}
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => open(row)} title="Изменить" className="p-2 rounded-full text-muted-foreground hover:text-gold hover:bg-rose-50 transition-colors">
                      <Pencil className="size-4" />
                    </button>
                    {canDelete && (
                      <button onClick={() => remove(row)} title="Удалить" className="p-2 rounded-full text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors">
                        <Trash className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-rose-50 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="bg-white p-6 border-b border-rose-100 flex items-center justify-between">
              <h2 className="text-2xl font-serif text-foreground">{editing === "new" ? "Добавить" : "Изменить"}</h2>
              <button
                onClick={() => setEditing(null)}
                aria-label="Закрыть"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors bg-rose-50 rounded-full"
              >
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={submit} noValidate className="p-6 md:p-8 space-y-4 overflow-y-auto">
              {formError && <ErrorMessage error={formError} />}
              {formFields.map((f) => (
                <div key={f.name} className={f.type === "checkbox" ? "flex items-center gap-3" : "space-y-1.5"}>
                  <label htmlFor={`crud-${f.name}`} className="text-sm font-medium text-foreground">
                    {f.label}
                  </label>
                  {input(f)}
                  {errors[f.name] && <p className="text-sm text-rose-600">{errors[f.name]}</p>}
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gold hover:bg-gold-hover text-white py-3 rounded-full font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
