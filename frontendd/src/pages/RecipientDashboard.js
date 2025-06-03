import React, { useState, useEffect } from 'react';
import {
    Container,
    Grid,
    Paper,
    Typography,
    Button,
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField
} from '@mui/material';
import {
    LocalHospital as HospitalIcon,
    Search as SearchIcon,
    Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';

const RecipientDashboard = () => {
    const { user } = useAuth();
    const { contract, account, requestBlood, getRecipientRequests, getAllHospitals } = useWeb3();
    const [requests, setRequests] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [newRequest, setNewRequest] = useState({
        bloodGroup: '',
        units: '1',
        urgency: 'normal',
        notes: ''
    });

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const urgencyLevels = ['normal', 'urgent', 'emergency'];

    useEffect(() => {
        if (contract && account) {
            loadData();
        }
    }, [contract, account]);

    const loadData = async () => {
        try {
            setLoading(true);
            
            // Get blood requests from blockchain
            try {
                const requestsData = await getRecipientRequests(account);
                if (requestsData && requestsData.length > 0) {
                    setRequests(requestsData);
                } else {
                    // Fallback to mock data if no requests found
                    setRequests([
                        {
                            id: 0,
                            bloodGroup: 'O+',
                            units: 1,
                            status: 'PENDING',
                            date: new Date().toISOString().split('T')[0],
                            hospital: '',
                            urgency: 'normal'
                        }
                    ]);
                }
            } catch (err) {
                console.error("Failed to get recipient requests:", err);
                // Use fallback mock data
                setRequests([
                    {
                        id: 0,
                        bloodGroup: 'O+',
                        units: 1,
                        status: 'PENDING',
                        date: new Date().toISOString().split('T')[0],
                        hospital: '',
                        urgency: 'normal'
                    }
                ]);
            }
            
            // Get hospitals from blockchain
            try {
                const hospitalsData = await getAllHospitals();
                if (hospitalsData && hospitalsData.length > 0) {
                    setHospitals(hospitalsData);
                } else {
                    // Fallback to mock data if no hospitals found
                    setHospitals([
                        {
                            address: '0x123...',
                            name: 'City General Hospital',
                            location: 'Downtown'
                        }
                    ]);
                }
            } catch (err) {
                console.error("Failed to get hospitals:", err);
                // Use fallback mock data
                setHospitals([
                    {
                        address: '0x123...',
                        name: 'City General Hospital',
                        location: 'Downtown'
                    }
                ]);
            }
        } catch (err) {
            setError('Failed to load data from blockchain');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDialogOpen = () => {
        setNewRequest({
            bloodGroup: user?.profile?.bloodGroup || '',
            units: '1',
            urgency: 'normal',
            notes: ''
        });
        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewRequest(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmitRequest = async () => {
        try {
            setLoading(true);
            // Call smart contract to create request
            await requestBlood(newRequest.bloodGroup);
            
            // Add to local state (with blockchain request ID, but fallback to timestamp if unavailable)
            setRequests(prev => [{
                id: Date.now(), // This will be replaced with actual ID from blockchain event in real implementation
                ...newRequest,
                status: 'PENDING',
                date: new Date().toISOString().split('T')[0],
                hospital: ''
            }, ...prev]);
            
            handleDialogClose();
            
            // Reload data to get updated state from blockchain
            setTimeout(() => loadData(), 2000);
        } catch (err) {
            setError('Failed to submit blood request: ' + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'FULFILLED':
                return 'success';
            case 'PENDING':
                return 'warning';
            case 'REJECTED':
                return 'error';
            default:
                return 'default';
        }
    };

    const getUrgencyColor = (urgency) => {
        switch (urgency) {
            case 'emergency':
                return 'error';
            case 'urgent':
                return 'warning';
            default:
                return 'info';
        }
    };

    const getHospitalName = (address) => {
        if (!address) return 'Pending Assignment';
        const hospital = hospitals.find(h => h.address === address);
        return hospital ? hospital.name : `Hospital (${address.slice(0, 6)}...${address.slice(-4)})`;
    };

    if (loading && requests.length === 0) {
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
                {/* Profile Card */}
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
                            Recipient Profile
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Name: {user?.profile?.name}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Location: {user?.profile?.location}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Contact: {user?.profile?.phone}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Quick Actions */}
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
                            variant="contained"
                            startIcon={<HospitalIcon />}
                            onClick={handleDialogOpen}
                            sx={{ mb: 2 }}
                        >
                            New Blood Request
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SearchIcon />}
                            sx={{ mb: 2 }}
                        >
                            Find Nearby Hospitals
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<NotificationsIcon />}
                        >
                            Manage Notifications
                        </Button>
                    </Paper>
                </Grid>

                {/* Statistics */}
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
                            Request Statistics
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Total Requests: {requests.length}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Pending: {requests.filter(r => r.status === 'PENDING').length}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Fulfilled: {requests.filter(r => r.status === 'FULFILLED').length}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Request List */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Blood Requests
                        </Typography>
                        {requests.length === 0 ? (
                            <Typography variant="body1" sx={{ my: 2 }}>
                                No blood requests found.
                            </Typography>
                        ) : (
                            <List>
                                {requests.map((request, index) => (
                                    <React.Fragment key={request.id}>
                                        {index > 0 && <Divider />}
                                        <ListItem
                                            alignItems="flex-start"
                                            sx={{
                                                py: 2,
                                                '&:hover': {
                                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                                }
                                            }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="h6">
                                                            {request.bloodGroup} Blood Request
                                                        </Typography>
                                                        <Chip
                                                            label={request.status}
                                                            size="small"
                                                            color={getStatusColor(request.status)}
                                                        />
                                                        <Chip
                                                            label={request.urgency}
                                                            size="small"
                                                            color={getUrgencyColor(request.urgency)}
                                                        />
                                                    </Box>
                                                }
                                                secondary={
                                                    <React.Fragment>
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            color="text.primary"
                                                        >
                                                            {getHospitalName(request.hospital)} - {request.date}
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            Units: {request.units}
                                                        </Typography>
                                                    </React.Fragment>
                                                }
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* New Request Dialog */}
            <Dialog open={openDialog} onClose={handleDialogClose}>
                <DialogTitle>New Blood Request</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="blood-group-label">Blood Group</InputLabel>
                        <Select
                            labelId="blood-group-label"
                            name="bloodGroup"
                            value={newRequest.bloodGroup}
                            onChange={handleInputChange}
                            label="Blood Group"
                            required
                        >
                            {bloodGroups.map(group => (
                                <MenuItem key={group} value={group}>
                                    {group}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        margin="normal"
                        name="units"
                        label="Units Required"
                        type="number"
                        fullWidth
                        value={newRequest.units}
                        onChange={handleInputChange}
                        InputProps={{ inputProps: { min: 1 } }}
                        required
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="urgency-label">Urgency Level</InputLabel>
                        <Select
                            labelId="urgency-label"
                            name="urgency"
                            value={newRequest.urgency}
                            onChange={handleInputChange}
                            label="Urgency Level"
                        >
                            {urgencyLevels.map(level => (
                                <MenuItem key={level} value={level}>
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        margin="normal"
                        name="notes"
                        label="Additional Notes"
                        multiline
                        rows={4}
                        fullWidth
                        value={newRequest.notes}
                        onChange={handleInputChange}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose}>Cancel</Button>
                    <Button 
                        onClick={handleSubmitRequest} 
                        variant="contained"
                        disabled={!newRequest.bloodGroup || !newRequest.units}
                    >
                        Submit Request
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default RecipientDashboard; 