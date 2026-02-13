# Portal MKK 1

## Deploy в Coolify (Nixpacks)

Проект уже подготовлен:
- `nixpacks.toml` задает фазы `install/build/start`
- production запуск: `npm run start`
- приложение слушает порт из переменной `PORT`

### Что указать в Coolify

1. Source: этот репозиторий.
2. Build Pack: `Nixpacks`.
3. Branch: `main`.
4. Port: `4173` (или любой другой, Coolify передаст его через `PORT`).

### Локальная проверка

```bash
npm ci
npm run build
PORT=8080 npm run start
```
