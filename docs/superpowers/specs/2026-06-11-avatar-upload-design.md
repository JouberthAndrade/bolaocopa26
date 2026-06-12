# Avatar Upload — Design Spec
**Date:** 2026-06-11  
**Status:** Approved

## Overview

Adicionar upload de foto de perfil no Quintinha. O usuário clica no avatar na página de perfil, seleciona uma imagem, e ela é salva automaticamente via Vercel Blob. Remove o campo de URL manual existente.

## Architecture

### 1. Storage — Vercel Blob
- Pacote: `@vercel/blob`
- Variável de ambiente: `BLOB_READ_WRITE_TOKEN` (adicionada no Vercel dashboard)
- Arquivos armazenados em path: `avatars/<userId>/<timestamp>.<ext>`
- URLs públicas retornadas pelo Blob são salvas no campo `User.image` (já existe no schema)

### 2. API Route — `/api/avatar/upload`
- **Método:** POST
- **Auth:** `requireUserId()` — rejeita 401 se não autenticado
- **Input:** `FormData` com campo `file` (Blob/File)
- **Validação:**
  - Tipo MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
  - Tamanho máximo: 2MB
- **Processamento:**
  1. Valida sessão e arquivo
  2. Chama `put()` do Vercel Blob com `access: 'public'`
  3. Chama `db.user.update()` para salvar a URL no campo `image`
  4. Retorna `{ url: string }` com status 200
- **Erros:** retorna `{ error: string }` com status adequado (400, 401, 413, 500)

### 3. ProfileForm — `src/components/profile/profile-form.tsx`
- Remove o `<Input name="image">` de URL manual
- Adiciona avatar circular clicável no topo do card de dados:
  - Exibe foto atual (`<Image>`) ou iniciais do nome como fallback
  - Ícone de câmera em hover (overlay semitransparente)
  - `<input type="file" accept="image/*">` oculto, disparado via `ref`
- **onChange do input:**
  1. Valida tamanho no cliente (> 2MB → mensagem de erro, aborta)
  2. Seta estado `uploading = true` (spinner no avatar, Salvar desabilitado)
  3. `POST /api/avatar/upload` com FormData
  4. Em sucesso: `router.refresh()` para atualizar sessão/avatar
  5. Em erro: exibe mensagem abaixo do avatar
  6. Seta `uploading = false`

### 4. Server Action — `updateProfile`
Sem alteração. Já aceita qualquer URL válida no campo `image`.

## Data Flow

```
[Clique no avatar]
  → <input file> abre seletor
  → onChange: valida tamanho no cliente
  → POST /api/avatar/upload (FormData)
    → requireUserId() → 401 se não autenticado
    → valida MIME + tamanho
    → Vercel Blob.put() → URL pública
    → db.user.update({ image: url })
    → return { url }
  → router.refresh() → avatar atualizado
```

## Files Changed

| File | Action |
|------|--------|
| `package.json` | add `@vercel/blob` |
| `src/app/api/avatar/upload/route.ts` | create |
| `src/components/profile/profile-form.tsx` | modify |

## Error Handling

| Cenário | Comportamento |
|---------|---------------|
| Arquivo > 2MB | Mensagem de erro no cliente, sem request |
| MIME inválido | Mensagem de erro no cliente (accept filtra), 400 na API |
| Não autenticado | API retorna 401 |
| Falha no Blob | API retorna 500, mensagem de erro no avatar |

## Environment Variables

```
BLOB_READ_WRITE_TOKEN=<token do Vercel Blob>
```

Adicionar no Vercel dashboard em Settings → Environment Variables.

## Constraints

- Sem migration de banco necessária (`User.image` já existe)
- Sem biblioteca de crop — upload direto da foto selecionada
- Fotos antigas no Blob não são deletadas (custo negligenciável no free tier)
