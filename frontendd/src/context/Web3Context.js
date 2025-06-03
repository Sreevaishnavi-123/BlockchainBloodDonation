import React, { createContext, useState, useContext, useEffect } from 'react';
import { ethers } from 'ethers';
import BloodDonationSystem from '../artifacts/contracts/BloodDonationSystem.sol/BloodDonationSystem.json';

const Web3Context = createContext(null);

export { Web3Context };
export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider = ({ children }) => {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contract, setContract] = useState(null);
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Use a default contract address if not set in environment
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    useEffect(() => {
        initializeEthers();
        
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
        }
        
        // Add listener for the custom logout event
        const handleLogout = () => {
            disconnectWallet();
        };
        window.addEventListener('userLogout', handleLogout);
        
        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
            window.removeEventListener('userLogout', handleLogout);
        };
    }, []);

    const initializeEthers = async () => {
        try {
            if (window.ethereum) {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                setProvider(provider);

                try {
                    // Get accounts without prompting user
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    
                    if (accounts.length > 0) {
                        // Check if user has deliberately disconnected before
                        const wasDisconnected = localStorage.getItem('walletDisconnected') === 'true';
                        
                        if (!wasDisconnected) {
                            setAccount(accounts[0]);
                            const signer = provider.getSigner();
                            setSigner(signer);
                            
                            try {
                                const contract = new ethers.Contract(
                                    contractAddress,
                                    BloodDonationSystem.abi,
                                    signer
                                );
                                setContract(contract);
                                // Mark as connected
                                localStorage.setItem('walletConnected', 'true');
                                localStorage.removeItem('walletDisconnected');
                            } catch (contractErr) {
                                console.error("Contract initialization error:", contractErr);
                                setError("Failed to initialize contract. Please check if the contract is deployed at the correct address.");
                            }
                        } else {
                            // User previously disconnected, don't auto-connect
                            setError("Wallet was previously disconnected. Please connect manually.");
                        }
                    } else {
                        // No accounts connected yet, but MetaMask is available
                        setError("Please connect your MetaMask wallet");
                    }
                } catch (accountsErr) {
                    console.error("Error getting accounts:", accountsErr);
                    setError("Failed to access MetaMask accounts. Please check your wallet connection.");
                }
            } else {
                setError('MetaMask not detected. Please install MetaMask to use this application.');
            }
        } catch (err) {
            console.error("Ethereum initialization error:", err);
            setError(`Failed to initialize Ethereum provider: ${err.message || "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    const connectWallet = async () => {
        setError(null); // Clear previous errors
        
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask not detected. Please install MetaMask to use this application.');
            }
            
            // First disconnect by clearing any connection state in local storage
            localStorage.removeItem('walletConnected');
            localStorage.setItem('walletDisconnected', 'true');
            
            // Force MetaMask to show the account selection dialog by using eth_requestAccounts with forceSelection
            const accounts = await window.ethereum.request({
                method: 'wallet_requestPermissions',
                params: [{
                    eth_accounts: {}
                }]
            }).then(() => window.ethereum.request({
                method: 'eth_requestAccounts'
            }));
            
            if (accounts.length === 0) {
                throw new Error('No accounts found. Please create or unlock an account in MetaMask.');
            }
            
            setAccount(accounts[0]);
            localStorage.setItem('walletConnected', 'true');
            localStorage.removeItem('walletDisconnected');
            
            // Initialize signer and contract
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            setSigner(signer);
            
            try {
                const contract = new ethers.Contract(
                    contractAddress,
                    BloodDonationSystem.abi,
                    signer
                );
                setContract(contract);
            } catch (contractErr) {
                console.error("Contract initialization error:", contractErr);
                throw new Error("Failed to initialize contract. Please check if the contract is deployed correctly.");
            }
            
            return accounts[0];
        } catch (err) {
            const errorMessage = err.message || "Unknown wallet connection error";
            console.error("Wallet connection error:", err);
            setError(errorMessage);
            throw err;
        }
    };

    const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
            setAccount(accounts[0]);
            // Re-initialize signer and contract with new account
            if (provider) {
                const signer = provider.getSigner();
                setSigner(signer);
                
                try {
                    const contract = new ethers.Contract(
                        contractAddress,
                        BloodDonationSystem.abi,
                        signer
                    );
                    setContract(contract);
                } catch (err) {
                    console.error("Error reinitializing contract:", err);
                    setError("Error reconnecting to contract. Please refresh the page.");
                }
            }
        } else {
            setAccount(null);
            setSigner(null);
            setError("No accounts connected. Please connect your wallet.");
        }
    };

    const disconnectWallet = async () => {
        // Reset the state
        setAccount(null);
        setSigner(null);
        setError(null);
        
        // Clear any cached connection data and mark as disconnected
        localStorage.removeItem('walletConnected');
        localStorage.setItem('walletDisconnected', 'true');
        
        // You can't truly "disconnect" from MetaMask programmatically,
        // but we can clear the state and force a reset of provider and signer
        if (window.ethereum && provider) {
            try {
                // Keep the provider for read-only operations
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const contract = new ethers.Contract(
                    contractAddress,
                    BloodDonationSystem.abi,
                    provider
                );
                setContract(contract);
                setProvider(provider);
            } catch (err) {
                console.error("Error during wallet disconnect:", err);
                setError("Error during wallet disconnect. You may need to refresh the page.");
            }
        }
    };

    // Contract interaction methods with better error handling
    const registerDonor = async (bloodGroup) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            if (!account) throw new Error("Wallet not connected");
            
            setError(null);
            const tx = await contract.registerDonor(bloodGroup);
            await tx.wait();
            return tx;
        } catch (err) {
            const errorMessage = err.message || "Failed to register donor";
            console.error("Register donor error:", err);
            setError(`Failed to register donor: ${errorMessage}`);
            throw err;
        }
    };

    const recordBloodDonation = async (donorAddress, bloodGroup) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            if (!account) throw new Error("Wallet not connected");
            
            setError(null);
            const tx = await contract.recordBloodDonation(donorAddress, bloodGroup);
            await tx.wait();
            return tx;
        } catch (err) {
            const errorMessage = err.message || "Unknown error";
            console.error("Record donation error:", err);
            setError(`Failed to record blood donation: ${errorMessage}`);
            throw err;
        }
    };

    const requestBlood = async (bloodGroup) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            if (!account) throw new Error("Wallet not connected");
            
            setError(null);
            const tx = await contract.requestBlood(bloodGroup);
            await tx.wait();
            return tx;
        } catch (err) {
            const errorMessage = err.message || "Unknown error";
            console.error("Request blood error:", err);
            setError(`Failed to request blood: ${errorMessage}`);
            throw err;
        }
    };

    const updateRequestStatus = async (requestId, status) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            if (!account) throw new Error("Wallet not connected");
            
            setError(null);
            const tx = await contract.updateRequestStatus(requestId, status);
            await tx.wait();
            return tx;
        } catch (err) {
            const errorMessage = err.message || "Unknown error";
            console.error("Update request status error:", err);
            setError(`Failed to update request status: ${errorMessage}`);
            throw err;
        }
    };

    // Add these additional contract interaction methods
    
    // =============== Donor-related methods ===============
    const getDonorHistory = async (donorAddress) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            // This is a mock implementation since your contract doesn't store donation history
            // In a real implementation, you would query donation events from the contract
            const filter = contract.filters.BloodDonated(donorAddress);
            const events = await contract.queryFilter(filter);
            
            return events.map(event => {
                const { donor, hospital, bloodGroup } = event.args;
                return {
                    id: event.transactionHash,
                    donor,
                    hospital,
                    bloodGroup,
                    date: new Date(event.blockTimestamp * 1000).toISOString().split('T')[0],
                    status: 'Verified',
                    pointsEarned: 10
                };
            });
        } catch (err) {
            const errorMessage = err.message || "Failed to get donor history";
            console.error("Donor history error:", err);
            setError(`Failed to get donation history: ${errorMessage}`);
            throw err;
        }
    };
    
    const getRewardPoints = async (donorAddress) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            const donorInfo = await contract.getDonorInfo(donorAddress || account);
            return donorInfo.rewardPoints.toNumber();
        } catch (err) {
            const errorMessage = err.message || "Failed to get reward points";
            console.error("Reward points error:", err);
            setError(`Failed to get reward points: ${errorMessage}`);
            throw err;
        }
    };
    
    // =============== Hospital-related methods ===============
    const getHospitalInventory = async (hospitalAddress) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
            const results = await Promise.all(
                bloodGroups.map(async (group) => {
                    const quantity = await contract.getHospitalInventory(hospitalAddress || account, group);
                    return {
                        bloodGroup: group,
                        quantity: quantity.toNumber(),
                        lastUpdated: new Date().toISOString().split('T')[0]
                    };
                })
            );
            
            // Only return blood groups with non-zero quantities
            return results.filter(item => item.quantity > 0);
        } catch (err) {
            const errorMessage = err.message || "Failed to get hospital inventory";
            console.error("Hospital inventory error:", err);
            setError(`Failed to get inventory: ${errorMessage}`);
            throw err;
        }
    };
    
    const getPendingRequests = async () => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            // Get all blood requests
            const requestCount = await contract.requestCount();
            const requests = [];
            
            for (let i = 0; i < requestCount; i++) {
                const request = await contract.bloodRequests(i);
                requests.push({
                    id: i,
                    recipient: request.recipient,
                    bloodGroup: request.bloodGroup,
                    status: request.status,
                    date: new Date(request.requestTime.toNumber() * 1000).toISOString().split('T')[0],
                    hospital: request.hospital,
                    units: 1 // Your contract doesn't track units, so defaulting to 1
                });
            }
            
            return requests;
        } catch (err) {
            const errorMessage = err.message || "Failed to get pending requests";
            console.error("Pending requests error:", err);
            setError(`Failed to get blood requests: ${errorMessage}`);
            throw err;
        }
    };
    
    // =============== Recipient-related methods ===============
    const getRecipientRequests = async (recipientAddress) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            // Get all blood requests for this recipient
            const requestCount = await contract.requestCount();
            const requests = [];
            
            for (let i = 0; i < requestCount; i++) {
                const request = await contract.bloodRequests(i);
                
                // Only include requests from this recipient
                if (request.recipient === (recipientAddress || account)) {
                    requests.push({
                        id: i,
                        bloodGroup: request.bloodGroup,
                        status: request.status,
                        date: new Date(request.requestTime.toNumber() * 1000).toISOString().split('T')[0],
                        hospital: request.hospital,
                        units: 1,
                        urgency: 'normal' // Your contract doesn't track urgency, so defaulting to normal
                    });
                }
            }
            
            return requests;
        } catch (err) {
            const errorMessage = err.message || "Failed to get recipient requests";
            console.error("Recipient requests error:", err);
            setError(`Failed to get blood requests: ${errorMessage}`);
            throw err;
        }
    };
    
    // =============== Shared methods ===============
    const getAllHospitals = async () => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            // This is a mock implementation since your contract doesn't have a method to get all hospitals
            // In a real implementation, you would query hospital registration events from the contract
            const filter = contract.filters.HospitalRegistered();
            const events = await contract.queryFilter(filter);
            
            return await Promise.all(events.map(async (event) => {
                const { hospital, name } = event.args;
                const hospitalData = await contract.hospitals(hospital);
                
                return {
                    address: hospital,
                    name,
                    location: hospitalData.location,
                    isVerified: hospitalData.isVerified
                };
            }));
        } catch (err) {
            const errorMessage = err.message || "Failed to get hospitals";
            console.error("Get hospitals error:", err);
            setError(`Failed to get hospitals: ${errorMessage}`);
            throw err;
        }
    };

    // Add these donation scheduling methods
    
    // Schedule a donation at a specific hospital and time
    const scheduleDonation = async (hospitalAddress, scheduledTime) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            if (!account) throw new Error("Wallet not connected");
            
            setError(null);
            const tx = await contract.scheduleDonation(hospitalAddress, scheduledTime);
            await tx.wait();
            return tx;
        } catch (err) {
            const errorMessage = err.message || "Failed to schedule donation";
            console.error("Schedule donation error:", err);
            setError(`Failed to schedule donation: ${errorMessage}`);
            throw err;
        }
    };
    
    // Update a donation schedule status (SCHEDULED, COMPLETED, CANCELLED)
    const updateScheduleStatus = async (scheduleId, status) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            if (!account) throw new Error("Wallet not connected");
            
            setError(null);
            const tx = await contract.updateScheduleStatus(scheduleId, status);
            await tx.wait();
            return tx;
        } catch (err) {
            const errorMessage = err.message || "Failed to update schedule status";
            console.error("Update schedule status error:", err);
            setError(`Failed to update schedule status: ${errorMessage}`);
            throw err;
        }
    };
    
    // Get donor's scheduled donations
    const getDonorSchedules = async (donorAddress) => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            // Get schedule IDs
            const scheduleIds = await contract.getDonorSchedules(donorAddress || account);
            
            // Get details for each schedule
            const schedules = await Promise.all(
                scheduleIds.map(async (id) => {
                    const scheduleDetails = await contract.getScheduleDetails(id);
                    
                    // Get hospital name
                    let hospitalName = "";
                    try {
                        const hospital = await contract.hospitals(scheduleDetails.hospital);
                        hospitalName = hospital.name;
                    } catch (err) {
                        console.error("Error getting hospital name:", err);
                        hospitalName = `Hospital (${scheduleDetails.hospital.slice(0, 6)}...${scheduleDetails.hospital.slice(-4)})`;
                    }
                    
                    return {
                        id: id.toNumber(),
                        donor: scheduleDetails.donor,
                        hospital: scheduleDetails.hospital,
                        hospitalName,
                        scheduledTime: new Date(scheduleDetails.scheduledTime.toNumber() * 1000),
                        scheduledDate: new Date(scheduleDetails.scheduledTime.toNumber() * 1000).toISOString().split('T')[0],
                        status: scheduleDetails.status
                    };
                })
            );
            
            return schedules;
        } catch (err) {
            const errorMessage = err.message || "Failed to get donation schedules";
            console.error("Get donation schedules error:", err);
            setError(`Failed to get donation schedules: ${errorMessage}`);
            throw err;
        }
    };
    
    // Get all hospitals for scheduling
    const getAllVerifiedHospitals = async () => {
        try {
            if (!contract) throw new Error("Contract not initialized");
            
            setError(null);
            // This would ideally be implemented with an event query or an array in the contract
            // For now, we'll use the HospitalRegistered events to get a list of hospitals
            const filter = contract.filters.HospitalRegistered();
            const events = await contract.queryFilter(filter);
            
            const hospitals = await Promise.all(
                events.map(async (event) => {
                    const { hospital, name } = event.args;
                    try {
                        const hospitalData = await contract.hospitals(hospital);
                        return {
                            address: hospital,
                            name,
                            location: hospitalData.location,
                            isVerified: hospitalData.isVerified
                        };
                    } catch (err) {
                        return {
                            address: hospital,
                            name,
                            location: "Unknown",
                            isVerified: true
                        };
                    }
                })
            );
            
            // Filter to only include verified hospitals
            return hospitals.filter(h => h.isVerified);
        } catch (err) {
            const errorMessage = err.message || "Failed to get hospitals";
            console.error("Get hospitals error:", err);
            setError(`Failed to get hospitals: ${errorMessage}`);
            throw err;
        }
    };

    // Add these methods to the context value
    const value = {
        provider,
        signer,
        contract,
        account,
        loading,
        error,
        connectWallet,
        disconnectWallet,
        registerDonor,
        recordBloodDonation,
        requestBlood,
        updateRequestStatus,
        getDonorHistory,
        getRewardPoints,
        getHospitalInventory,
        getPendingRequests,
        getRecipientRequests,
        getAllHospitals,
        // Add the new scheduling methods
        scheduleDonation,
        updateScheduleStatus,
        getDonorSchedules,
        getAllVerifiedHospitals
    };

    return (
        <Web3Context.Provider value={value}>
            {children}
        </Web3Context.Provider>
    );
}; 