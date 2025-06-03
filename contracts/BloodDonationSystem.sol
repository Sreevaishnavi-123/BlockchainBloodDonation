// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract BloodDonationSystem is AccessControl, Pausable {
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Donor {
        address walletAddress;
        string bloodGroup;
        uint256 lastDonationTime;
        uint256 rewardPoints;
        bool isRegistered;
    }

    struct BloodRequest {
        address recipient;
        string bloodGroup;
        uint256 requestTime;
        string status; // "PENDING", "APPROVED", "FULFILLED", "REJECTED"
        address hospital;
    }

    struct Hospital {
        string name;
        string location;
        bool isVerified;
    }

    struct BloodInventory {
        string bloodGroup;
        uint256 quantity;
    }

    // New struct for donation scheduling
    struct DonationSchedule {
        address donor;
        address hospital;
        uint256 scheduledTime;
        string status; // "SCHEDULED", "COMPLETED", "CANCELLED"
    }

    mapping(address => Donor) public donors;
    mapping(address => Hospital) public hospitals;
    mapping(uint256 => BloodRequest) public bloodRequests;
    mapping(address => mapping(string => uint256)) public hospitalInventory;
    
    // New mappings for donation scheduling
    mapping(uint256 => DonationSchedule) public donationSchedules;
    uint256 public scheduleCount;
    mapping(address => uint256[]) public donorSchedules; // Donor address to their schedule IDs
    mapping(address => uint256[]) public hospitalSchedules; // Hospital address to their schedule IDs
    
    uint256 public requestCount;
    uint256 public constant MINIMUM_DONATION_INTERVAL = 90 days;
    uint256 public constant POINTS_PER_DONATION = 10;

    event DonorRegistered(address indexed donor, string bloodGroup);
    event BloodDonated(address indexed donor, address indexed hospital, string bloodGroup);
    event BloodRequested(uint256 indexed requestId, address indexed recipient, string bloodGroup);
    event RequestStatusUpdated(uint256 indexed requestId, string status);
    event RewardPointsAdded(address indexed donor, uint256 points);
    event HospitalRegistered(address indexed hospital, string name);
    
    // New events for donation scheduling
    event DonationScheduled(uint256 indexed scheduleId, address indexed donor, address indexed hospital, uint256 scheduledTime);
    event ScheduleStatusUpdated(uint256 indexed scheduleId, string status);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    modifier onlyHospital() {
        require(hasRole(HOSPITAL_ROLE, msg.sender), "Caller is not a hospital");
        _;
    }

    function registerDonor(string memory _bloodGroup) external {
        require(!donors[msg.sender].isRegistered, "Donor already registered");
        donors[msg.sender] = Donor({
            walletAddress: msg.sender,
            bloodGroup: _bloodGroup,
            lastDonationTime: 0,
            rewardPoints: 0,
            isRegistered: true
        });
        emit DonorRegistered(msg.sender, _bloodGroup);
    }

    function registerHospital(address _hospital, string memory _name, string memory _location) 
        external onlyRole(ADMIN_ROLE) {
        require(!hospitals[_hospital].isVerified, "Hospital already registered");
        hospitals[_hospital] = Hospital({
            name: _name,
            location: _location,
            isVerified: true
        });
        _setupRole(HOSPITAL_ROLE, _hospital);
        emit HospitalRegistered(_hospital, _name);
    }

    // New function to schedule a donation
    function scheduleDonation(address _hospital, uint256 _scheduledTime) external whenNotPaused {
        require(donors[msg.sender].isRegistered, "Donor not registered");
        require(hospitals[_hospital].isVerified, "Hospital not registered");
        require(_scheduledTime > block.timestamp, "Scheduled time must be in the future");
        
        // If within minimum donation interval, check if the scheduled time will be valid
        if (donors[msg.sender].lastDonationTime > 0) {
            require(
                _scheduledTime >= donors[msg.sender].lastDonationTime + MINIMUM_DONATION_INTERVAL,
                "Must schedule after minimum donation interval"
            );
        }
        
        donationSchedules[scheduleCount] = DonationSchedule({
            donor: msg.sender,
            hospital: _hospital,
            scheduledTime: _scheduledTime,
            status: "SCHEDULED"
        });
        
        // Add schedule ID to donor's and hospital's list
        donorSchedules[msg.sender].push(scheduleCount);
        hospitalSchedules[_hospital].push(scheduleCount);
        
        emit DonationScheduled(scheduleCount, msg.sender, _hospital, _scheduledTime);
        scheduleCount++;
    }
    
    // Function to update donation schedule status
    function updateScheduleStatus(uint256 _scheduleId, string memory _status) external whenNotPaused {
        require(_scheduleId < scheduleCount, "Invalid schedule ID");
        DonationSchedule storage schedule = donationSchedules[_scheduleId];
        
        // Verify the caller is either the donor or the hospital
        require(
            schedule.donor == msg.sender || schedule.hospital == msg.sender,
            "Only donor or hospital can update status"
        );
        
        // If hospital is completing the donation, record it
        if (schedule.hospital == msg.sender && 
            keccak256(bytes(_status)) == keccak256(bytes("COMPLETED"))) {
            
            // Get donor's blood group
            string memory bloodGroup = donors[schedule.donor].bloodGroup;
            
            // Check minimum donation interval
            require(
                block.timestamp >= donors[schedule.donor].lastDonationTime + MINIMUM_DONATION_INTERVAL,
                "Must wait between donations"
            );
            
            // Record the donation
            donors[schedule.donor].lastDonationTime = block.timestamp;
            hospitalInventory[msg.sender][bloodGroup]++;
            
            // Award points
            donors[schedule.donor].rewardPoints += POINTS_PER_DONATION;
            
            emit BloodDonated(schedule.donor, msg.sender, bloodGroup);
            emit RewardPointsAdded(schedule.donor, POINTS_PER_DONATION);
        }
        
        schedule.status = _status;
        emit ScheduleStatusUpdated(_scheduleId, _status);
    }
    
    // Function to get donor's schedules
    function getDonorSchedules(address _donor) external view returns (uint256[] memory) {
        return donorSchedules[_donor];
    }
    
    // Function to get hospital's schedules
    function getHospitalSchedules(address _hospital) external view returns (uint256[] memory) {
        return hospitalSchedules[_hospital];
    }

    function recordBloodDonation(address _donor, string memory _bloodGroup) 
        external onlyHospital whenNotPaused {
        require(donors[_donor].isRegistered, "Donor not registered");
        require(
            block.timestamp >= donors[_donor].lastDonationTime + MINIMUM_DONATION_INTERVAL,
            "Must wait between donations"
        );

        donors[_donor].lastDonationTime = block.timestamp;
        hospitalInventory[msg.sender][_bloodGroup]++;
        
        // Award points
        donors[_donor].rewardPoints += POINTS_PER_DONATION;
        
        emit BloodDonated(_donor, msg.sender, _bloodGroup);
        emit RewardPointsAdded(_donor, POINTS_PER_DONATION);
    }

    function requestBlood(string memory _bloodGroup) external whenNotPaused {
        bloodRequests[requestCount] = BloodRequest({
            recipient: msg.sender,
            bloodGroup: _bloodGroup,
            requestTime: block.timestamp,
            status: "PENDING",
            hospital: address(0)
        });
        
        emit BloodRequested(requestCount, msg.sender, _bloodGroup);
        requestCount++;
    }

    function updateRequestStatus(uint256 _requestId, string memory _status) 
        external onlyHospital whenNotPaused {
        require(_requestId < requestCount, "Invalid request ID");
        BloodRequest storage request = bloodRequests[_requestId];
        request.status = _status;
        request.hospital = msg.sender;
        
        if (keccak256(bytes(_status)) == keccak256(bytes("FULFILLED"))) {
            hospitalInventory[msg.sender][request.bloodGroup]--;
        }
        
        emit RequestStatusUpdated(_requestId, _status);
    }

    function getDonorInfo(address _donor) external view returns (
        string memory bloodGroup,
        uint256 lastDonationTime,
        uint256 rewardPoints,
        bool isRegistered
    ) {
        Donor memory donor = donors[_donor];
        return (
            donor.bloodGroup,
            donor.lastDonationTime,
            donor.rewardPoints,
            donor.isRegistered
        );
    }

    function getHospitalInventory(address _hospital, string memory _bloodGroup) 
        external view returns (uint256) {
        return hospitalInventory[_hospital][_bloodGroup];
    }
    
    // Function to get schedule details
    function getScheduleDetails(uint256 _scheduleId) external view returns (
        address donor,
        address hospital,
        uint256 scheduledTime,
        string memory status
    ) {
        require(_scheduleId < scheduleCount, "Invalid schedule ID");
        DonationSchedule memory schedule = donationSchedules[_scheduleId];
        return (
            schedule.donor,
            schedule.hospital,
            schedule.scheduledTime,
            schedule.status
        );
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
} 