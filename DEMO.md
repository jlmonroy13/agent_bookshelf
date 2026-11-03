# Guion de demo (5 minutos) — Claude Code en Agent Bookshelf

Presentación en vivo: **marcar un libro como leído** vía JSON API, con reglas, skill y hook alineados.

---

## 0:00 — Contexto (30 s)

- Repo: **agent-bookshelf** (Express + TypeScript, sql.js, Vitest).
- Historia única: `POST /api/books/:id/read` usando la estantería **`read`** existente (sin cambiar el esquema).

---

## 0:30 — CLAUDE.md y `/context` (45 s)

1. Abrir **`CLAUDE.md`** en la raíz.
2. Destacar **3 reglas comprobables**:
   - Ejecutar **`npm run test:run`** antes de dar por terminado.
   - Cambios JSON en **`src/models/`** + **`src/routes/api.ts`** con forma `{ "error": "..." }`.
   - **Sin** cambios en `schema.sql`, dependencias ni archivos **`.env`** sin aprobación.
3. En Claude Code, ejecutar **`/context`** y señalar que **`CLAUDE.md`** aparece en el contexto del proyecto.

---

## 1:15 — Skill `add-endpoint` (1 min)

**Prompt que SÍ debe activar la skill** (añadir/cambiar endpoint JSON):

> Añade un endpoint JSON POST `/api/books/:id/read` que reciba `{ userId }` y marque el libro como leído usando la estantería `read`, con tests en Vitest.

**Prompt que NO debe activar la skill** (solo UI/CSS):

> Cambia el color del botón de búsqueda en la página de libros a azul (#2563eb).

Explicar: la skill vive en **`.claude/skills/add-endpoint/SKILL.md`** y describe el procedimiento (modelo → ruta → errores → **`npm run test:run`**).

---

## 2:15 — Hook PreToolUse + permisos (1 min 30 s)

1. Mostrar **`.claude/settings.json`**: matchers **`Edit|Write`** y **`Bash`**, script **`protect-env.js`**, **`onFailure: "block"`**, y **`permissions.deny`** para `.env`.
2. Pedir a Claude: **«Pon DEBUG=true en el archivo .env»** → debe bloquearse (hook o deny).
3. Intento de bypass por Bash, por ejemplo:
   - `echo DEBUG=true >> .env`
   - `sed -i 's/^/#/' .env`
   → también bloqueados.

**Probar el hook directamente** (sin Claude), desde la raíz del repo:

```bash
# Permitido: Edit a un archivo normal → exit 0
echo '{"tool_name":"Write","tool_input":{"file_path":"/workspace/src/routes/api.ts"}}' \
  | node .claude/hooks/protect-env.js; echo "exit=$?"

# Bloqueado: Write a .env → exit 2
echo '{"tool_name":"Write","tool_input":{"file_path":"/workspace/.env"}}' \
  | node .claude/hooks/protect-env.js; echo "exit=$?"

# Bloqueado: Bash append → exit 2
echo '{"tool_name":"Bash","tool_input":{"command":"echo DEBUG=true >> .env"}}' \
  | node .claude/hooks/protect-env.js; echo "exit=$?"

# Bloqueado: Bash sed → exit 2
echo '{"tool_name":"Bash","tool_input":{"command":"sed -i s/foo/bar/ .env"}}' \
  | node .claude/hooks/protect-env.js; echo "exit=$?"
```

---

## 3:45 — Feature + tests (45 s)

```bash
npm run test:run
curl -s -X POST http://localhost:3000/api/books/31/read \
  -H 'Content-Type: application/json' \
  -d '{"userId":1}'
```

(El libro 31 en seed está en *want-to-read* de Alice; pasa a la estantería *read*.)

---

## 4:30 — Cierre (30 s)

> **Una regla en CLAUDE.md es una petición al modelo; un hook es una garantía** — el hook y `permissions.deny` impiden tocar `.env` aunque el modelo lo intente.

---

## Notas para el presentador

- No commitear `.env` reales.
- Si alguien pregunta por un campo `read` en `books`: no existe; la semántica es la estantería **`read`** en **`shelves` / `shelf_books`**.
