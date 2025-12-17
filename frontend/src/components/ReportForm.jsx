import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { submitReport } from '../services/api';

function ReportForm() {
  const [formData, setFormData] = useState({
    ngo_id: '',
    month: '',
    people_helped: '',
    events_conducted: '',
    funds_utilized: '',
  });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.ngo_id.trim()) {
      newErrors.ngo_id = 'NGO ID is required';
    }

    if (!formData.month) {
      newErrors.month = 'Month is required';
    }

    const peopleHelped = parseInt(formData.people_helped);
    if (formData.people_helped === '' || isNaN(peopleHelped) || peopleHelped < 0) {
      newErrors.people_helped = 'Must be a non-negative number';
    }

    const eventsConducted = parseInt(formData.events_conducted);
    if (formData.events_conducted === '' || isNaN(eventsConducted) || eventsConducted < 0) {
      newErrors.events_conducted = 'Must be a non-negative number';
    }

    const fundsUtilized = parseFloat(formData.funds_utilized);
    if (formData.funds_utilized === '' || isNaN(fundsUtilized) || fundsUtilized < 0) {
      newErrors.funds_utilized = 'Must be a non-negative number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        people_helped: parseInt(formData.people_helped) || 0,
        events_conducted: parseInt(formData.events_conducted) || 0,
        funds_utilized: parseFloat(formData.funds_utilized) || 0,
      };

      await submitReport(payload);

      setSnackbar({
        open: true,
        message: 'Report submitted successfully!',
        severity: 'success',
      });

      // Reset form
      setFormData({
        ngo_id: '',
        month: '',
        people_helped: '',
        events_conducted: '',
        funds_utilized: '',
      });
    } catch (error) {
      const errorMessage = error.response?.data?.errors?.join(', ') ||
        error.response?.data?.error ||
        'Failed to submit report';

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Submit Monthly Report
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="NGO ID"
                  name="ngo_id"
                  value={formData.ngo_id}
                  onChange={handleChange}
                  error={!!errors.ngo_id}
                  helperText={errors.ngo_id || 'Unique identifier for your NGO'}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Month"
                  name="month"
                  type="month"
                  value={formData.month}
                  onChange={handleChange}
                  error={!!errors.month}
                  helperText={errors.month || 'Select the reporting month'}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="People Helped"
                  name="people_helped"
                  type="number"
                  value={formData.people_helped}
                  onChange={handleChange}
                  error={!!errors.people_helped}
                  helperText={errors.people_helped}
                  InputProps={{ inputProps: { min: 0 } }}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Events Conducted"
                  name="events_conducted"
                  type="number"
                  value={formData.events_conducted}
                  onChange={handleChange}
                  error={!!errors.events_conducted}
                  helperText={errors.events_conducted}
                  InputProps={{ inputProps: { min: 0 } }}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Funds Utilized"
                  name="funds_utilized"
                  type="number"
                  value={formData.funds_utilized}
                  onChange={handleChange}
                  error={!!errors.funds_utilized}
                  helperText={errors.funds_utilized}
                  InputProps={{
                    inputProps: { min: 0, step: 0.01 },
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  endIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  fullWidth
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </Button>
              </Grid>
            </Grid>
          </form>
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

export default ReportForm;
