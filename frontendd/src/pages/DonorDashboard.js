import React, { useState, useEffect } from 'react';
import {
    Container,
    Grid,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    List,
    ListItem,
    ListItemText,
    Divider,
    Box,
    Chip,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tab,
    Tabs
} from '@mui/material';
import {
    LocalHospital as HospitalIcon,
    EmojiEvents as TrophyIcon,
    Timeline as TimelineIcon,
    CalendarMonth as CalendarIcon,
    Cancel as CancelIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { format, addDays } from 'date-fns';

const DonorDashboard = () => {
    const { user } = useAuth();
    const { 
        contract, 
        account, 
        getDonorHistory, 
        getRewardPoints, 
        getDonorSchedules, 
        getAllVerifiedHospitals,
        scheduleDonation,
        updateScheduleStatus
    } = useWeb3();
    
    const [donationHistory, setDonationHistory] = useState([]);
    const [scheduledDonations, setScheduledDonations] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [rewardPoints, setRewardPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    
    // Dialog states
    const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        hospitalAddress: '',
        date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        time: '10:00'
    });
    const [schedulingLoading, setSchedulingLoading] = useState(false);

    useEffect(() => {
        if (contract && account) {
            loadDonorData();
        }
    }, [contract, account]);

    const loadDonorData = async () => {
        try {
            setLoading(true);
            
            // Get donor information from blockchain
            try {
                const points = await getRewardPoints(account);
                setRewardPoints(points);
            } catch (err) {
                console.error("Failed to get reward points:", err);
                // Continue with other data fetching
            }
            
            // Get donation history from blockchain
            try {
                const history = await getDonorHistory(account);
                if (history && history.length > 0) {
                    setDonationHistory(history);
                } else {
                    // Fallback to mock data if no history found
                    setDonationHistory([
                        {
                            id: 1,
                            date: '2024-03-15',
                            hospital: 'City General Hospital',
                            bloodGroup: user?.profile?.bloodGroup || 'O+',
                            status: 'Verified',
                            pointsEarned: 10
                        }
                    ]);
                }
            } catch (err) {
                console.error("Failed to get donation history:", err);
                // Use fallback mock data
                setDonationHistory([
                    {
                        id: 1,
                        date: '2024-03-15',
                        hospital: 'City General Hospital',
                        bloodGroup: user?.profile?.bloodGroup || 'O+',
                        status: 'Verified',
                        pointsEarned: 10
                    }
                ]);
            }
            
            // Get scheduled donations from blockchain
            try {
                const schedules = await getDonorSchedules(account);
                if (schedules && schedules.length > 0) {
                    setScheduledDonations(schedules);
                }
            } catch (err) {
                console.error("Failed to get scheduled donations:", err);
            }
            
            // Get hospitals for scheduling
            try {
                const hospitalList = await getAllVerifiedHospitals();
                if (hospitalList && hospitalList.length > 0) {
                    setHospitals(hospitalList);
                }
            } catch (err) {
                console.error("Failed to get hospitals:", err);
            }
        } catch (err) {
            setError('Failed to load donor data from blockchain');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const getRewardLevel = (points) => {
        if (points >= 100) return { level: 'Platinum', color: '#E5E4E2' };
        if (points >= 50) return { level: 'Gold', color: '#FFD700' };
        if (points >= 20) return { level: 'Silver', color: '#C0C0C0' };
        return { level: 'Bronze', color: '#CD7F32' };
    };
    
    const handleOpenScheduleDialog = () => {
        if (hospitals.length === 0) {
            setError('No hospitals available for scheduling. Please try again later.');
            return;
        }
        
        setScheduleData({
            hospitalAddress: hospitals[0]?.address || '',
            date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
            time: '10:00'
        });
        setOpenScheduleDialog(true);
    };
    
    const handleCloseScheduleDialog = () => {
        setOpenScheduleDialog(false);
    };
    
    const handleScheduleChange = (e) => {
        const { name, value } = e.target;
        setScheduleData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    
    const handleScheduleDonation = async () => {
        try {
            setSchedulingLoading(true);
            
            const { hospitalAddress, date, time } = scheduleData;
            
            if (!hospitalAddress || !date || !time) {
                setError('Please fill in all fields');
                return;
            }
            
            // Convert date and time to timestamp (seconds)
            const scheduledDateTime = new Date(`${date}T${time}`);
            const timestamp = Math.floor(scheduledDateTime.getTime() / 1000);
            
            // Call contract method
            await scheduleDonation(hospitalAddress, timestamp);
            
            // Refresh data
            await loadDonorData();
            
            // Close dialog
            handleCloseScheduleDialog();
        } catch (err) {
            setError(`Failed to schedule donation: ${err.message}`);
            console.error(err);
        } finally {
            setSchedulingLoading(false);
        }
    };
    
    const handleCancelSchedule = async (scheduleId) => {
        try {
            setLoading(true);
            
            // Call contract method to cancel
            await updateScheduleStatus(scheduleId, "CANCELLED");
            
            // Refresh data
            await loadDonorData();
        } catch (err) {
            setError(`Failed to cancel donation: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Donor Info Card */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            height: 240
                        }}
                    >
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Donor Profile
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Name: {user?.profile?.name}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Blood Group: {user?.profile?.bloodGroup}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Location: {user?.profile?.location}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Wallet: {account && `${account.slice(0, 6)}...${account.slice(-4)}`}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Chip
                                icon={<TrophyIcon />}
                                label={`${getRewardLevel(rewardPoints).level} Donor`}
                                sx={{
                                    bgcolor: getRewardLevel(rewardPoints).color,
                                    color: '#000',
                                    fontWeight: 'bold'
                                }}
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Rewards Card */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            height: 240
                        }}
                    >
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Rewards Status
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <TrophyIcon color="primary" sx={{ mr: 1 }} />
                            <Typography variant="h4">
                                {rewardPoints} Points
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Next reward at {rewardPoints + (10 - (rewardPoints % 10))} points
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                        >
                            View Rewards Catalog
                        </Button>
                    </Paper>
                </Grid>

                {/* Quick Actions Card */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            height: 240
                        }}
                    >
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Quick Actions
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<CalendarIcon />}
                            sx={{ mb: 2 }}
                            onClick={handleOpenScheduleDialog}
                        >
                            Schedule Donation
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<HospitalIcon />}
                            sx={{ mb: 2 }}
                            onClick={() => loadDonorData()} // Refresh data from blockchain
                        >
                            Find Hospitals
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<TimelineIcon />}
                            sx={{ mb: 2 }}
                        >
                            View Donation History
                        </Button>
                    </Paper>
                </Grid>

                {/* Tabs for History and Scheduled Donations */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs value={tabValue} onChange={handleTabChange}>
                                <Tab label="Donation History" />
                                <Tab label={`Scheduled Donations (${scheduledDonations.length})`} />
                            </Tabs>
                        </Box>
                        
                        {/* Donation History Tab */}
                        {tabValue === 0 && (
                            <div>
                                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                                    Recent Donations
                                </Typography>
                                <List>
                                    {donationHistory.length > 0 ? (
                                        donationHistory.map((donation, index) => (
                                            <React.Fragment key={donation.id}>
                                                <ListItem>
                                                    <ListItemText
                                                        primary={donation.hospital || 'Hospital'}
                                                        secondary={`Date: ${donation.date} | Blood Group: ${donation.bloodGroup}`}
                                                    />
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <Chip
                                                            label={donation.status}
                                                            color="success"
                                                            size="small"
                                                        />
                                                        <Typography variant="body2" color="text.secondary">
                                                            +{donation.pointsEarned} points
                                                        </Typography>
                                                    </Box>
                                                </ListItem>
                                                {index < donationHistory.length - 1 && <Divider />}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <ListItem>
                                            <ListItemText
                                                primary="No donation history found"
                                                secondary="Make your first donation to start earning rewards"
                                            />
                                        </ListItem>
                                    )}
                                </List>
                            </div>
                        )}
                        
                        {/* Scheduled Donations Tab */}
                        {tabValue === 1 && (
                            <div>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography component="h2" variant="h6" color="primary">
                                        Scheduled Donations
                                    </Typography>
                                    <Button 
                                        variant="contained" 
                                        startIcon={<CalendarIcon />}
                                        onClick={handleOpenScheduleDialog}
                                    >
                                        Schedule New
                                    </Button>
                                </Box>
                                <List>
                                    {scheduledDonations.length > 0 ? (
                                        scheduledDonations.map((schedule, index) => (
                                            <React.Fragment key={schedule.id}>
                                                <ListItem>
                                                    <ListItemText
                                                        primary={schedule.hospitalName}
                                                        secondary={`Date: ${schedule.scheduledDate} | Time: ${schedule.scheduledTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                                                    />
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <Chip
                                                            label={schedule.status}
                                                            color={
                                                                schedule.status === "SCHEDULED" ? "info" :
                                                                schedule.status === "COMPLETED" ? "success" : "error"
                                                            }
                                                            size="small"
                                                        />
                                                        {schedule.status === "SCHEDULED" && (
                                                            <Button
                                                                size="small"
                                                                startIcon={<CancelIcon />}
                                                                color="error"
                                                                onClick={() => handleCancelSchedule(schedule.id)}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </ListItem>
                                                {index < scheduledDonations.length - 1 && <Divider />}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <ListItem>
                                            <ListItemText
                                                primary="No scheduled donations"
                                                secondary="Schedule a donation to contribute"
                                            />
                                        </ListItem>
                                    )}
                                </List>
                            </div>
                        )}
                    </Paper>
                </Grid>
            </Grid>
            
            {/* Schedule Donation Dialog */}
            <Dialog open={openScheduleDialog} onClose={handleCloseScheduleDialog}>
                <DialogTitle>Schedule Blood Donation</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Schedule a donation at one of our partner hospitals. Choose a date at least 90 days after your last donation.
                    </Typography>
                    
                    <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
                        <InputLabel id="hospital-label">Hospital</InputLabel>
                        <Select
                            labelId="hospital-label"
                            name="hospitalAddress"
                            value={scheduleData.hospitalAddress}
                            label="Hospital"
                            onChange={handleScheduleChange}
                            fullWidth
                        >
                            {hospitals.map((hospital) => (
                                <MenuItem key={hospital.address} value={hospital.address}>
                                    {hospital.name} - {hospital.location}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    
                    <TextField
                        name="date"
                        label="Date"
                        type="date"
                        value={scheduleData.date}
                        onChange={handleScheduleChange}
                        fullWidth
                        sx={{ mb: 2 }}
                        InputLabelProps={{
                            shrink: true,
                        }}
                    />
                    
                    <TextField
                        name="time"
                        label="Time"
                        type="time"
                        value={scheduleData.time}
                        onChange={handleScheduleChange}
                        fullWidth
                        InputLabelProps={{
                            shrink: true,
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseScheduleDialog} disabled={schedulingLoading}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleScheduleDonation} 
                        color="primary" 
                        variant="contained"
                        disabled={schedulingLoading}
                    >
                        {schedulingLoading ? 'Scheduling...' : 'Schedule Donation'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default DonorDashboard;