import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import { uploadCSV, getJobStatus } from '../services/api';

// Helper to check if job is in a terminal state
const isTerminalStatus = (status) => status === 'completed' || status === 'failed';

function BulkUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Poll for job status - stops on both 'completed' AND 'failed'
  useEffect(() => {
    let isMounted = true;

    if (jobId && !isTerminalStatus(jobStatus?.status)) {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await getJobStatus(jobId);
          if (isMounted) {
            setJobStatus(response.data);
            // Stop polling on terminal states (completed or failed)
            if (isTerminalStatus(response.data.status)) {
              clearInterval(pollingRef.current);
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error('Error polling job status:', error);
          }
        }
      }, 1000);

      return () => {
        isMounted = false;
        clearInterval(pollingRef.current);
      };
    }
  }, [jobId, jobStatus?.status]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setSnackbar({
          open: true,
          message: 'Please select a CSV file',
          severity: 'error',
        });
        return;
      }
      setFile(selectedFile);
      setJobId(null);
      setJobStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setSnackbar({
        open: true,
        message: 'Please select a file first',
        severity: 'error',
      });
      return;
    }

    setUploading(true);

    try {
      const response = await uploadCSV(file);
      setJobId(response.jobId);
      setJobStatus({ status: 'pending', processedRows: 0, totalRows: 0 });
      setSnackbar({
        open: true,
        message: 'File uploaded! Processing started.',
        severity: 'success',
      });
    } catch (error) {
      const errorMessage = error.response?.data?.errors?.join(', ') ||
        error.response?.data?.error || 'Failed to upload file';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setJobId(null);
    setJobStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const getProgressPercent = () => {
    if (!jobStatus || jobStatus.totalRows === 0) return 0;
    return Math.round((jobStatus.processedRows / jobStatus.totalRows) * 100);
  };

  const getStatusColor = () => {
    if (!jobStatus) return 'default';
    switch (jobStatus.status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'primary';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Bulk Report Upload
      </Typography>

      <Card sx={{ maxWidth: 700 }}>
        <CardContent>
          {/* File Upload Section */}
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'primary.main',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              backgroundColor: 'grey.50',
              mb: 3,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Upload CSV File
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              CSV should contain columns: ngo_id, month, people_helped, events_conducted, funds_utilized
            </Typography>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              ref={fileInputRef}
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button variant="outlined" component="span">
                Select File
              </Button>
            </label>

            {file && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="body2">{file.name}</Typography>
                <Chip label={`${(file.size / 1024).toFixed(1)} KB`} size="small" />
              </Box>
            )}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!file || uploading || (jobStatus && ['pending','processing'].includes(jobStatus.status))}

              fullWidth
            >
              {uploading ? 'Uploading...' : 'Upload & Process'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={uploading || (jobStatus && jobStatus.status === 'processing')}
            >
              Reset
            </Button>
          </Box>

          {/* Job Status Section */}
          {jobStatus && (
            <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Processing Status</Typography>
                <Chip
                  label={jobStatus.status.toUpperCase()}
                  color={getStatusColor()}
                  size="small"
                />
              </Box>

              {jobStatus.totalRows > 0 && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Progress: {jobStatus.processedRows} of {jobStatus.totalRows} rows
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {getProgressPercent()}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getProgressPercent()}
                      color={jobStatus.status === 'failed' ? 'error' : 'primary'}
                      sx={{ height: 10, borderRadius: 1 }}
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" />
                      <Typography variant="body2">
                        Successful: {jobStatus.successfulRows}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ErrorIcon color="error" />
                      <Typography variant="body2">
                        Failed: {jobStatus.failedRows}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}

              {/* Error Details */}
              {jobStatus.errors && jobStatus.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Errors ({jobStatus.errors.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {jobStatus.errors.slice(0, 10).map((error, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <ErrorIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={error}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                    {jobStatus.errors.length > 10 && (
                      <ListItem>
                        <ListItemText
                          primary={`... and ${jobStatus.errors.length - 10} more errors`}
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}

              {/* Completed Alert */}
              {jobStatus.status === 'completed' && (
                <Alert
                  severity={jobStatus.failedRows > 0 ? 'warning' : 'success'}
                  sx={{ mt: 2 }}
                >
                  {jobStatus.failedRows > 0
                    ? `Processing completed with ${jobStatus.failedRows} errors. ${jobStatus.successfulRows} reports saved successfully.`
                    : `All ${jobStatus.successfulRows} reports processed successfully!`}
                </Alert>
              )}

              {/* Failed Alert */}
              {jobStatus.status === 'failed' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Processing failed. {jobStatus.errors?.[0] || 'An error occurred while processing the CSV file.'}
                </Alert>
              )}
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Sample CSV Format */}
      <Card sx={{ maxWidth: 700, mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            CSV Format Guide
          </Typography>
          <Paper sx={{ p: 2, backgroundColor: 'grey.900', color: 'grey.100', fontFamily: 'monospace', fontSize: 12 }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              ngo_id,month,people_helped,events_conducted,funds_utilized{'\n'}
              NGO001,2024-01,150,5,50000{'\n'}
              NGO002,2024-01,200,8,75000{'\n'}
              NGO003,2024-01,100,3,25000
            </pre>
          </Paper>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Note: If a report for the same NGO and month already exists, it will be updated (idempotent).
          </Typography>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default BulkUpload;
