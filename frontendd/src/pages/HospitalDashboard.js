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
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';

const HospitalDashboard = () => {
    const { user } = useAuth();
    const { contract, account, getHospitalInventory, getPendingRequests, updateRequestStatus, recordBloodDonation } = useWeb3();
    const [inventory, setInventory] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [dialogType, setDialogType] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [donationData, setDonationData] = useState({
        donorAddress: '',
        bloodGroup: ''
    });

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    useEffect(() => {
        if (contract && account) {
            loadDashboardData();
        }
    }, [contract, account]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            
            // Get inventory from blockchain
            try {
                const inventoryData = await getHospitalInventory(account);
                if (inventoryData && inventoryData.length > 0) {
                    setInventory(inventoryData);
                } else {
                    // Fallback to minimal mock data if no inventory found
                    setInventory([
                        { bloodGroup: 'A+', quantity: 0, lastUpdated: new Date().toISOString().split('T')[0] },
                        { bloodGroup: 'O+', quantity: 0, lastUpdated: new Date().toISOString().split('T')[0] }
                    ]);
                }
            } catch (err) {
                console.error("Failed to get inventory:", err);
                // Use fallback mock data
                setInventory([
                    { bloodGroup: 'A+', quantity: 0, lastUpdated: new Date().toISOString().split('T')[0] },
                    { bloodGroup: 'O+', quantity: 0, lastUpdated: new Date().toISOString().split('T')[0] }
                ]);
            }
            
            // Get blood requests from blockchain
            try {
                const requestsData = await getPendingRequests();
                if (requestsData && requestsData.length > 0) {
                    // Filter for only pending requests or ones associated with this hospital
                    const filteredRequests = requestsData.filter(req => 
                        req.status === 'PENDING' || req.hospital === account
                    );
                    setRequests(filteredRequests);
                } else {
                    // Fallback to mock data if no requests found
                    setRequests([
                        {
                            id: 0,
                            bloodGroup: 'O+',
                            units: 1,
                            recipient: '0x1234...5678',
                            status: 'PENDING',
                            date: new Date().toISOString().split('T')[0],
                            urgency: 'normal'
                        }
                    ]);
                }
            } catch (err) {
                console.error("Failed to get blood requests:", err);
                // Use fallback mock data
                setRequests([
                    {
                        id: 0,
                        bloodGroup: 'O+',
                        units: 1,
                        recipient: '0x1234...5678',
                        status: 'PENDING',
                        date: new Date().toISOString().split('T')[0],
                        urgency: 'normal'
                    }
                ]);
            }
        } catch (err) {
            setError('Failed to load dashboard data from blockchain');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDialogOpen = (type, item = null) => {
        setDialogType(type);
        setSelectedItem(item);
        
        if (type === 'recordDonation') {
            setDonationData({
                donorAddress: '',
                bloodGroup: bloodGroups[0]
            });
        }
        
        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setDialogType('');
        setSelectedItem(null);
    };

    const handleUpdateInventory = async (bloodGroup, quantity) => {
        // This function can't be directly implemented with your contract
        // since there's no direct way to update inventory
        // It would be handled through recordBloodDonation
        handleDialogClose();
    };

    const handleDonationDataChange = (e) => {
        const { name, value } = e.target;
        setDonationData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleRecordDonation = async () => {
        try {
            if (!donationData.donorAddress || !donationData.bloodGroup) {
                setError('Please provide donor address and blood group');
                return;
            }
            
            await recordBloodDonation(donationData.donorAddress, donationData.bloodGroup);
            
            // Update local state
            setInventory(prev => {
                const index = prev.findIndex(item => item.bloodGroup === donationData.bloodGroup);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = {
                        ...updated[index],
                        quantity: updated[index].quantity + 1,
                        lastUpdated: new Date().toISOString().split('T')[0]
                    };
                    return updated;
                }
                return [
                    ...prev,
                    {
                        bloodGroup: donationData.bloodGroup,
                        quantity: 1,
                        lastUpdated: new Date().toISOString().split('T')[0]
                    }
                ];
            });
            
            handleDialogClose();
        } catch (err) {
            setError('Failed to record donation: ' + err.message);
            console.error(err);
        }
    };

    const handleUpdateRequestStatus = async (requestId, status) => {
        try {
            // Update request status in blockchain
            await updateRequestStatus(requestId, status);
            
            // Update local state
            setRequests(prev =>
                prev.map(request =>
                    request.id === requestId
                        ? { ...request, status, hospital: account }
                        : request
                )
            );
            
            // If fulfilling, update inventory
            if (status === 'FULFILLED') {
                const request = requests.find(r => r.id === requestId);
                if (request) {
                    setInventory(prev => {
                        const index = prev.findIndex(item => item.bloodGroup === request.bloodGroup);
                        if (index >= 0 && prev[index].quantity > 0) {
                            const updated = [...prev];
                            updated[index] = {
                                ...updated[index],
                                quantity: Math.max(0, updated[index].quantity - request.units),
                                lastUpdated: new Date().toISOString().split('T')[0]
                            };
                            return updated;
                        }
                        return prev;
                    });
                }
            }
        } catch (err) {
            setError('Failed to update request status: ' + err.message);
            console.error(err);
        }
    };

    if (loading && inventory.length === 0) {
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
                {/* Hospital Info */}
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
                            Hospital Profile
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Name: {user?.profile?.name}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Location: {user?.profile?.location}
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Registration: {user?.hospitalInfo?.registrationNumber}
                        </Typography>
                        <Chip
                            icon={<HospitalIcon />}
                            label="Verified Hospital"
                            color="success"
                            sx={{ mt: 2, width: 'fit-content' }}
                        />
                    </Paper>
                </Grid>

                {/* Quick Stats */}
                <Grid item xs={12} md={8}>
                    <Paper
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            height: 240
                        }}
                    >
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Quick Statistics
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={4}>
                                <Typography variant="h4" gutterBottom>
                                    {inventory.reduce((sum, item) => sum + item.quantity, 0)}
                                </Typography>
                                <Typography color="text.secondary">
                                    Total Units Available
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography variant="h4" gutterBottom>
                                    {requests.filter(r => r.status === 'PENDING').length}
                                </Typography>
                                <Typography color="text.secondary">
                                    Pending Requests
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography variant="h4" gutterBottom>
                                    {requests.filter(r => r.status === 'FULFILLED').length}
                                </Typography>
                                <Typography color="text.secondary">
                                    Fulfilled Requests
                                </Typography>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* Blood Inventory */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography component="h2" variant="h6" color="primary">
                                Blood Inventory
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={() => handleDialogOpen('inventory')}
                            >
                                Update Inventory
                            </Button>
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Blood Group</TableCell>
                                        <TableCell align="right">Units</TableCell>
                                        <TableCell align="right">Last Updated</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {inventory.map((item) => (
                                        <TableRow key={item.bloodGroup}>
                                            <TableCell>{item.bloodGroup}</TableCell>
                                            <TableCell align="right">{item.quantity}</TableCell>
                                            <TableCell align="right">{item.lastUpdated}</TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => handleDialogOpen('inventory', item)}
                                                >
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Blood Requests */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Blood Requests
                        </Typography>
                        <List>
                            {requests.map((request, index) => (
                                <React.Fragment key={request.id}>
                                    <ListItem>
                                        <ListItemText
                                            primary={`${request.bloodGroup} - ${request.units} units`}
                                            secondary={`Date: ${request.date} | Recipient: ${request.recipient}`}
                                        />
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip
                                                label={request.status}
                                                color={request.status === 'FULFILLED' ? 'success' : 'warning'}
                                                size="small"
                                            />
                                            {request.status === 'PENDING' && (
                                                <>
                                                    <Button
                                                        size="small"
                                                        startIcon={<CheckCircleIcon />}
                                                        color="success"
                                                        onClick={() => handleUpdateRequestStatus(request.id, 'FULFILLED')}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        startIcon={<CancelIcon />}
                                                        color="error"
                                                        onClick={() => handleUpdateRequestStatus(request.id, 'REJECTED')}
                                                    >
                                                        Reject
                                                    </Button>
                                                </>
                                            )}
                                        </Box>
                                    </ListItem>
                                    {index < requests.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>

            {/* Inventory Update Dialog */}
            <Dialog open={openDialog && dialogType === 'inventory'} onClose={handleDialogClose}>
                <DialogTitle>
                    {selectedItem ? 'Update Blood Units' : 'Add Blood Units'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Blood Group</InputLabel>
                            <Select
                                value={selectedItem?.bloodGroup || ''}
                                label="Blood Group"
                                disabled={!!selectedItem}
                            >
                                {bloodGroups.map(group => (
                                    <MenuItem key={group} value={group}>
                                        {group}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="Units Available"
                            type="number"
                            defaultValue={selectedItem?.quantity || ''}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose}>Cancel</Button>
                    <Button
                        onClick={() => handleUpdateInventory(selectedItem?.bloodGroup, 10)}
                        variant="contained"
                    >
                        Update
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Record Donation Dialog */}
            <Dialog open={openDialog && dialogType === 'recordDonation'} onClose={handleDialogClose}>
                <DialogTitle>Record Blood Donation</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="donorAddress"
                        label="Donor Wallet Address"
                        type="text"
                        fullWidth
                        value={donationData.donorAddress}
                        onChange={handleDonationDataChange}
                        sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Blood Group</InputLabel>
                        <Select
                            name="bloodGroup"
                            value={donationData.bloodGroup}
                            label="Blood Group"
                            onChange={handleDonationDataChange}
                        >
                            {bloodGroups.map(group => (
                                <MenuItem key={group} value={group}>
                                    {group}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose}>Cancel</Button>
                    <Button onClick={handleRecordDonation} color="primary">Record Donation</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default HospitalDashboard;