# CRM Intake: Asterisk/FMC webhook templates

## 1) Backend env

Set in `backend/.env` (or Coolify variables):

```env
CRM_INTAKE_ENABLED=true
CRM_INTAKE_SHARED_SECRET=replace_with_long_secret
CRM_INTAKE_AUTO_ANALYZE_DEFAULT=true
```

Endpoint:

`POST /api/crm/intake/calls`

Auth header:

`x-crm-intake-secret: <CRM_INTAKE_SHARED_SECRET>`

## 2) Payload contract

Minimal payload:

```json
{
  "provider": "asterisk",
  "externalCallId": "ast-20260220-000123",
  "clientPhone": "+79991234567"
}
```

Recommended payload:

```json
{
  "provider": "asterisk",
  "externalCallId": "ast-20260220-000123",
  "eventType": "call_finished",
  "clientPhone": "+79991234567",
  "clientName": "Иван Петров",
  "employeePhone": "+79990001122",
  "startedAt": "2026-02-20T09:00:00.000Z",
  "endedAt": "2026-02-20T09:06:00.000Z",
  "durationSec": 360,
  "recordingUrl": "https://pbx.example/records/ast-20260220-000123.mp3",
  "transcriptRaw": "Полный текст расшифровки разговора...",
  "scriptContext": "Скрипт реактивации спящих клиентов",
  "source": "asterisk-main",
  "autoAnalyze": true,
  "createTasks": true
}
```

Notes:
- Idempotency key: `provider + externalCallId`.
- If client does not exist, backend creates it by `clientPhone`.
- If `transcriptRaw` is sent and `autoAnalyze=true`, QA/evaluation and suggested tasks are created automatically.

## 3) Quick local test

```bash
cd backend
CRM_INTAKE_URL=http://localhost:4000/api/crm/intake/calls \
CRM_INTAKE_SHARED_SECRET=replace_with_long_secret \
npm run crm:intake:sample
```

## 4) Asterisk template (HTTP post on call end)

Example dialplan idea (adapt fields to your PBX variables):

```asterisk
[crm-intake-hook]
exten => s,1,NoOp(CRM intake webhook)
 same => n,Set(CRM_URL=https://api.example.com/api/crm/intake/calls)
 same => n,Set(CRM_SECRET=replace_with_long_secret)
 same => n,Set(JSON={"provider":"asterisk","externalCallId":"${UNIQUEID}","eventType":"call_finished","clientPhone":"${CALLERID(num)}","employeePhone":"${CONNECTEDLINE(num)}","startedAt":"${STRFTIME(${CDR(start)},,%Y-%m-%dT%H:%M:%S.000Z)}","endedAt":"${STRFTIME(${EPOCH},,%Y-%m-%dT%H:%M:%S.000Z)}","durationSec":${CDR(billsec)},"recordingUrl":"${MIXMONITOR_FILENAME}","source":"asterisk"})
 same => n,System(curl -sS -X POST "${CRM_URL}" -H "Content-Type: application/json" -H "x-crm-intake-secret: ${CRM_SECRET}" -d '${JSON}')
 same => n,Return()
```

Alternative approach:
- Send CDR event into your integration service (Node/Python),
- service maps CDR fields to payload above and posts to `/api/crm/intake/calls`.

## 5) FMC template

If FMC provider supports webhooks, map fields:
- `call_id` -> `externalCallId`
- `client_number` -> `clientPhone`
- `employee_number` -> `employeePhone`
- `start_time/end_time` -> `startedAt/endedAt` (ISO)
- `duration_sec` -> `durationSec`
- `record_url` -> `recordingUrl`
- `transcript` -> `transcriptRaw`

Example outgoing request body:

```json
{
  "provider": "fmc",
  "externalCallId": "{{call_id}}",
  "eventType": "call_finished",
  "clientPhone": "{{client_number}}",
  "employeePhone": "{{employee_number}}",
  "startedAt": "{{start_time_iso}}",
  "endedAt": "{{end_time_iso}}",
  "durationSec": {{duration_sec}},
  "recordingUrl": "{{record_url}}",
  "transcriptRaw": "{{transcript}}",
  "source": "fmc",
  "autoAnalyze": true,
  "createTasks": true
}
```

Headers:
- `Content-Type: application/json`
- `x-crm-intake-secret: replace_with_long_secret`
