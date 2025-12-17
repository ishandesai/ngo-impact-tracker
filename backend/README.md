# ngo impact tracker backend

simple backend for ngo monthly reports + admin dashboard.

## stack

* node + express
* sqlite (better-sqlite3)
* multer (csv upload)
* csv-parse
* cors

## what it does

* **single report**: save 1 ngo report for 1 month
* **bulk upload**: upload csv, get **job id**, backend processes in background
* **job status**: frontend polls progress
* **dashboard**: totals + list of reports + filters + pagination
* **no duplicates**: same `ngo_id + month` gets **updated**, not double counted

## setup

```bash
npm install
npm run dev
# or: npm start
```

server:

* `http://localhost:3001`
* health: `GET /health`

api base:

* `http://localhost:3001/api`

## endpoints

### 1) submit one report

`POST /api/report`

```json
{
  "ngo_id": "NGO001",
  "month": "2024-01",
  "people_helped": 150,
  "events_conducted": 5,
  "funds_utilized": 50000
}
```

### 2) upload csv (background)

`POST /api/reports/upload` (form-data)

* key: `file`
* value: `.csv`

csv headers (must match):

```csv
ngo_id,month,people_helped,events_conducted,funds_utilized
```

response gives:

* `jobId`

### 3) check job status

`GET /api/job-status/:jobId`

returns:

* status: `pending | processing | completed | failed`
* counts: totalRows, processedRows, successfulRows, failedRows
* errors array

### 4) dashboard

`GET /api/dashboard`

examples:

* single month:
  `/api/dashboard?month=2024-01`
* range + ngo search:
  `/api/dashboard?month_from=2024-01&month_to=2024-06&ngo_id=NGO001`
* pagination:
  `/api/dashboard?offset=0&limit=20`

### 5) list reports

`GET /api/reports`
or by month:
`GET /api/reports?month=2024-01`

## quick test

health:

```bash
curl http://localhost:3001/health
```

submit:

```bash
curl -X POST http://localhost:3001/api/report \
-H "Content-Type: application/json" \
-d '{"ngo_id":"NGO001","month":"2024-01","people_helped":10,"events_conducted":2,"funds_utilized":1000}'
```
