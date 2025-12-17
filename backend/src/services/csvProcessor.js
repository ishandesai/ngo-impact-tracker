import { parse } from 'csv-parse';
import fs from 'fs';
import { insertOrUpdateReport, updateJobProgress } from '../database.js';

// Required CSV headers
const REQUIRED_HEADERS = ['ngo_id', 'month', 'people_helped', 'events_conducted', 'funds_utilized'];

// Validate CSV headers
function validateHeaders(headers) {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const missingHeaders = REQUIRED_HEADERS.filter(
    required => !normalizedHeaders.includes(required)
  );

  if (missingHeaders.length > 0) {
    return {
      isValid: false,
      error: `Missing required columns: ${missingHeaders.join(', ')}`
    };
  }

  return { isValid: true };
}

// Validate a single row
function validateRow(row, rowIndex) {
  const errors = [];

  // Check required fields
  if (!row.ngo_id || String(row.ngo_id).trim() === '') {
    errors.push(`Row ${rowIndex}: NGO ID is required`);
  }

  if (!row.month || String(row.month).trim() === '') {
    errors.push(`Row ${rowIndex}: Month is required`);
  } else if (!/^\d{4}-\d{2}$/.test(String(row.month).trim())) {
    errors.push(`Row ${rowIndex}: Month must be in YYYY-MM format`);
  }

  const peopleHelped = parseInt(row.people_helped);
  if (isNaN(peopleHelped) || peopleHelped < 0) {
    errors.push(`Row ${rowIndex}: People Helped must be a non-negative number`);
  }

  const eventsConducted = parseInt(row.events_conducted);
  if (isNaN(eventsConducted) || eventsConducted < 0) {
    errors.push(`Row ${rowIndex}: Events Conducted must be a non-negative number`);
  }

  const fundsUtilized = parseFloat(row.funds_utilized);
  if (isNaN(fundsUtilized) || fundsUtilized < 0) {
    errors.push(`Row ${rowIndex}: Funds Utilized must be a non-negative number`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      ngo_id: String(row.ngo_id).trim(),
      month: String(row.month).trim(),
      people_helped: peopleHelped || 0,
      events_conducted: eventsConducted || 0,
      funds_utilized: fundsUtilized || 0
    }
  };
}

// Clean up uploaded file
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to delete uploaded file:', err);
  }
}

// Set job to failed status
function setJobFailed(jobId, errorMessage) {
  updateJobProgress.run({
    id: jobId,
    total_rows: 0,
    processed_rows: 0,
    successful_rows: 0,
    failed_rows: 0,
    errors: JSON.stringify([errorMessage]),
    status: 'failed'
  });
}

// Process CSV file in background
export async function processCSVFile(filePath, jobId) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowIndex = 0;
    let headersValidated = false;
    let processingAborted = false;  // Flag to track if processing was aborted

    // First pass: read and validate all rows
    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
    );

    parser.on('data', (row) => {
      // Skip if processing was already aborted
      if (processingAborted) return;

      // Validate headers on first row
      if (!headersValidated) {
        const headers = Object.keys(row);
        console.log('[CSV Processor] Detected headers:', headers);
        const headerValidation = validateHeaders(headers);

        if (!headerValidation.isValid) {
          console.log('[CSV Processor] Header validation failed:', headerValidation.error);
          processingAborted = true;
          parser.destroy();
          setJobFailed(jobId, headerValidation.error);
          cleanupFile(filePath);
          reject(new Error(headerValidation.error));
          return;
        }
        headersValidated = true;
      }

      rowIndex++;
      results.push({ row, rowIndex });
    });

    parser.on('error', (err) => {
      console.log('[CSV Processor] Parse error:', err.message);
      processingAborted = true;
      // Set job status to failed when parser encounters an error
      setJobFailed(jobId, `CSV parse error: ${err.message}`);
      cleanupFile(filePath);
      reject(err);
    });

    parser.on('close', () => {
      // This fires when parser.destroy() is called
      console.log('[CSV Processor] Parser closed, aborted:', processingAborted);
    });

    parser.on('end', async () => {
      console.log('[CSV Processor] Parser ended, aborted:', processingAborted, 'results:', results.length);

      // Skip processing if we already aborted (header validation failed, parse error, etc.)
      if (processingAborted) {
        console.log('[CSV Processor] Skipping end handler - processing was aborted');
        return;
      }

      // Handle empty CSV file
      if (results.length === 0) {
        setJobFailed(jobId, 'CSV file is empty or contains no data rows');
        cleanupFile(filePath);
        resolve({
          totalRows: 0,
          successfulRows: 0,
          failedRows: 0,
          errors: ['CSV file is empty or contains no data rows']
        });
        return;
      }

      const totalRows = results.length;
      let processedRows = 0;
      let successfulRows = 0;
      let failedRows = 0;

      // Update job with total rows and set status to processing
      updateJobProgress.run({
        id: jobId,
        total_rows: totalRows,
        processed_rows: 0,
        successful_rows: 0,
        failed_rows: 0,
        errors: JSON.stringify([]),
        status: 'processing'
      });

      // Process each row with simulated delay for demo purposes
      for (const { row, rowIndex } of results) {
        // Add small delay to simulate processing time (for demo)
        await new Promise(r => setTimeout(r, 100));

        const validation = validateRow(row, rowIndex);
        processedRows++;

        if (validation.isValid) {
          try {
            insertOrUpdateReport.run(validation.data);
            successfulRows++;
          } catch (err) {
            failedRows++;
            errors.push(`Row ${rowIndex}: Database error - ${err.message}`);
          }
        } else {
          failedRows++;
          errors.push(...validation.errors);
        }

        // Update progress after each row
        updateJobProgress.run({
          id: jobId,
          total_rows: totalRows,
          processed_rows: processedRows,
          successful_rows: successfulRows,
          failed_rows: failedRows,
          errors: JSON.stringify(errors),
          status: processedRows === totalRows ? 'completed' : 'processing'
        });
      }

      // Clean up uploaded file
      cleanupFile(filePath);

      resolve({
        totalRows,
        successfulRows,
        failedRows,
        errors
      });
    });
  });
}
