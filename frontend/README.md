# NGO Impact Tracking – Frontend

hey 👋  
this is the **frontend** part of the NGO Impact Tracking app.

this app helps NGOs:
- submit monthly reports
- upload reports in bulk using csv
- see all data in admin dashboard

this project is built using **react + vite + material ui**.

---

## what this frontend can do

### 1. submit report
- NGO can submit one monthly report
- fields:
  - ngo id
  - month
  - people helped
  - events conducted
  - funds utilized
- form has basic validation
- shows success or error message after submit

---

### 2. bulk upload (csv)
- upload a csv file with many reports
- backend processes it in background
- frontend shows:
  - job status
  - progress bar
  - processed rows
  - success and failed rows
  - error list if any
- polling is used to check job status

---

### 3. admin dashboard
- shows summary cards:
  - total ngos reporting
  - total people helped
  - total events
  - total funds utilized
- table of individual reports
- filters:
  - month from
  - month to
  - ngo id
- infinite scroll for large data
- loading skeletons while data loads

---

## tech used

- react
- vite
- material ui (mui)
- react router
- axios


