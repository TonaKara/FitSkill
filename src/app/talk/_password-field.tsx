"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white py-2.5 pl-3 pr-11 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"

type TalkPasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

export function TalkPasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
  required,
}: TalkPasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-black">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}
