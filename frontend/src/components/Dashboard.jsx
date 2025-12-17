import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { getDashboard } from '../services/api';

function StatCard({ title, value, icon, color, tooltip }) {
  const card = (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {typeof value === 'number' ? value.toLocaleString() : (value ?? 'N/A')}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top">
      {card}
    </Tooltip>
  ) : card;
}

function StatCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="80%" height={40} />
          </Box>
          <Skeleton variant="circular" width={56} height={56} />
        </Box>
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton variant="text" /></TableCell>
      <TableCell><Skeleton variant="text" /></TableCell>
      <TableCell align="right"><Skeleton variant="text" /></TableCell>
      <TableCell align="right"><Skeleton variant="text" /></TableCell>
      <TableCell align="right"><Skeleton variant="text" /></TableCell>
    </TableRow>
  );
}

const RECORDS_PER_PAGE = 20;

function Dashboard() {
  // Filter states
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [ngoId, setNgoId] = useState('');

  // Data states
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ totalRecords: 0, hasMore: false });

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [dateError, setDateError] = useState('');

  // Ref for infinite scroll
  const tableContainerRef = useRef(null);

  // Count active filters (count single month as 1 filter, range as 1 filter)
  const hasMonthFilter = monthFrom || monthTo;
  const activeFilterCount = (hasMonthFilter ? 1 : 0) + (ngoId ? 1 : 0);

  // Validate date range
  const isDateRangeValid = () => {
    if (monthFrom && monthTo && monthFrom > monthTo) {
      return false;
    }
    return true;
  };

  // Fetch dashboard data
  const fetchDashboard = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      // Handle single month selection: use same value for both from/to
      const effectiveFrom = monthFrom || monthTo || undefined;
      const effectiveTo = monthTo || monthFrom || undefined;

      const response = await getDashboard({
        monthFrom: effectiveFrom,
        monthTo: effectiveTo,
        ngoId: ngoId || undefined,
        offset,
        limit: RECORDS_PER_PAGE,
      });

      const data = response.data;
      setSummary(data.summary);
      setPagination(data.pagination);

      if (append) {
        setReports((prev) => [...prev, ...data.reports]);
      } else {
        setReports(data.reports);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.errors?.join(', ') ||
        err.response?.data?.error || 'Failed to fetch dashboard data';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [monthFrom, monthTo, ngoId]);

  // Initial load
  useEffect(() => {
    fetchDashboard(0, false);
  }, [fetchDashboard]);

  // Handle filter apply
  const handleApplyFilters = () => {
    // Validate date range
    if (!isDateRangeValid()) {
      setDateError('"From" month cannot be after "To" month');
      return;
    }
    setDateError('');
    setReports([]);
    fetchDashboard(0, false);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setMonthFrom('');
    setMonthTo('');
    setNgoId('');
    setDateError('');
    setReports([]);
    setLoading(true);
    // Fetch without filters
    getDashboard({ offset: 0, limit: RECORDS_PER_PAGE })
      .then((response) => {
        setSummary(response.data.summary);
        setReports(response.data.reports);
        setPagination(response.data.pagination);
      })
      .catch((err) => {
        setError(err.response?.data?.errors?.join(', ') ||
          err.response?.data?.error || 'Failed to fetch dashboard data');
      })
      .finally(() => setLoading(false));
  };

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    // Prevent duplicate fetches and stop if no more data
    if (isNearBottom && pagination.hasMore && !loadingMore && !loading && reports.length < pagination.totalRecords) {
      fetchDashboard(reports.length, true);
    }
  }, [pagination.hasMore, loadingMore, loading, reports.length, pagination.totalRecords, fetchDashboard]);

  // Attach scroll listener
  useEffect(() => {
    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <TrendingUpIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4">
          Admin Dashboard
        </Typography>
      </Box>

      {/* Filter Section */}
      <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main' }}>
            <FilterListIcon fontSize="small" />
            <Typography variant="subtitle2" fontWeight="bold">Filters</Typography>
            {activeFilterCount > 0 && (
              <Chip
                label={activeFilterCount}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Box>

          <TextField
            type="month"
            label="From Month"
            value={monthFrom}
            onChange={(e) => {
              setMonthFrom(e.target.value);
              setDateError('');
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ minWidth: 150 }}
            error={!!dateError}
            helperText={!monthTo && monthFrom ? 'Single month selected' : ''}
          />

          <TextField
            type="month"
            label="To Month"
            value={monthTo}
            onChange={(e) => {
              setMonthTo(e.target.value);
              setDateError('');
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ minWidth: 150 }}
            error={!!dateError}
            helperText={dateError || (!monthFrom && monthTo ? 'Single month selected' : '')}
          />

          <TextField
            label="NGO ID"
            placeholder="Search..."
            value={ngoId}
            onChange={(e) => setNgoId(e.target.value)}
            size="small"
            sx={{ minWidth: 140 }}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />,
            }}
          />

          <Button
            variant="contained"
            size="small"
            onClick={handleApplyFilters}
            disabled={loading || !isDateRangeValid()}
          >
            Apply
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={handleClearFilters}
            disabled={loading || activeFilterCount === 0}
          >
            Clear
          </Button>
        </Box>
        {!isDateRangeValid() && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Invalid date range: "From Month" cannot be after "To Month"
          </Alert>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards - Show skeletons while loading */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              title="Total NGOs Reporting"
              value={summary?.totalNgosReporting || 0}
              icon={<GroupsIcon sx={{ fontSize: 32, color: 'primary.main' }} />}
              color="primary"
              tooltip="Number of unique NGOs that submitted reports"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              title="Total People Helped"
              value={summary?.totalPeopleHelped || 0}
              icon={<PeopleIcon sx={{ fontSize: 32, color: 'success.main' }} />}
              color="success"
              tooltip="Combined number of beneficiaries across all NGOs"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              title="Total Events Conducted"
              value={summary?.totalEventsConducted || 0}
              icon={<EventIcon sx={{ fontSize: 32, color: 'warning.main' }} />}
              color="warning"
              tooltip="Total events organized by all NGOs"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              title="Total Funds Utilized"
              value={formatCurrency(summary?.totalFundsUtilized || 0)}
              icon={<AccountBalanceIcon sx={{ fontSize: 32, color: 'info.main' }} />}
              color="info"
              tooltip="Total funds spent across all reported activities"
            />
          )}
        </Grid>
      </Grid>

      {/* Reports Table with Infinite Scroll */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Individual Reports
            </Typography>
            {!loading && (
              <Chip
                label={`${Math.min(reports.length, pagination.totalRecords)} of ${pagination.totalRecords}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <TableContainer
            component={Paper}
            variant="outlined"
            ref={tableContainerRef}
            sx={{ maxHeight: 500, overflow: 'auto' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: 'primary.main', color: 'white', fontWeight: 'bold' }}>NGO ID</TableCell>
                  <TableCell sx={{ backgroundColor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Month</TableCell>
                  <TableCell sx={{ backgroundColor: 'primary.main', color: 'white', fontWeight: 'bold' }} align="right">People Helped</TableCell>
                  <TableCell sx={{ backgroundColor: 'primary.main', color: 'white', fontWeight: 'bold' }} align="right">Events</TableCell>
                  <TableCell sx={{ backgroundColor: 'primary.main', color: 'white', fontWeight: 'bold' }} align="right">Funds Utilized</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // Show skeleton rows while loading
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
                ) : reports.length > 0 ? (
                  reports.map((report, index) => (
                    <TableRow
                      key={`${report.id}-${index}`}
                      hover
                      sx={{
                        backgroundColor: index % 2 === 0 ? 'transparent' : 'grey.50',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <TableCell>
                        <Chip label={report.ngo_id} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{report.month}</TableCell>
                      <TableCell align="right">{(report.people_helped ?? 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{(report.events_conducted ?? 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{formatCurrency(report.funds_utilized ?? 0)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No reports found matching your filters
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Try adjusting the filters or submit reports via the form or bulk upload.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Loading more indicator */}
            {loadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2, gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Loading more...
                </Typography>
              </Box>
            )}

            {/* End of list indicator */}
            {!loading && !pagination.hasMore && reports.length > 0 && (
              <Box sx={{ textAlign: 'center', py: 2, backgroundColor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary">
                  All {pagination.totalRecords} records loaded
                </Typography>
              </Box>
            )}
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Dashboard;
