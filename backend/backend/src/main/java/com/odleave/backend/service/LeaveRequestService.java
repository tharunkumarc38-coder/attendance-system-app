package com.odleave.backend.service;

import com.odleave.backend.entity.LeaveRequest;
import com.odleave.backend.repository.LeaveRequestRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LeaveRequestService {

    private final LeaveRequestRepository leaveRequestRepository;
    private final AttendanceService attendanceService;

    public LeaveRequestService(
            LeaveRequestRepository leaveRequestRepository,
            AttendanceService attendanceService) {

        this.leaveRequestRepository = leaveRequestRepository;
        this.attendanceService = attendanceService;
    }

    public LeaveRequest createLeaveRequest(LeaveRequest leaveRequest) {

        double attendancePercentage =
                attendanceService.getAttendancePercentage(
                        leaveRequest.getStudentId()
                );

        if (attendancePercentage >= 75.0) {
            leaveRequest.setStatus("APPROVED");
        } else {
            leaveRequest.setStatus("PENDING");
        }

        return leaveRequestRepository.save(leaveRequest);
    }

    public List<LeaveRequest> getAllLeaveRequests() {
        return leaveRequestRepository.findAll();
    }

    public LeaveRequest getLeaveRequestById(String id) {
        return leaveRequestRepository.findById(id).orElse(null);
    }

    public LeaveRequest updateLeaveRequest(
            String id,
            LeaveRequest leaveRequest) {

        LeaveRequest existingRequest =
                leaveRequestRepository.findById(id).orElse(null);

        if (existingRequest == null) {
            return null;
        }

        existingRequest.setStudentId(leaveRequest.getStudentId());
        existingRequest.setLeaveType(leaveRequest.getLeaveType());
        existingRequest.setFromDate(leaveRequest.getFromDate());
        existingRequest.setToDate(leaveRequest.getToDate());
        existingRequest.setReason(leaveRequest.getReason());
        existingRequest.setStatus(leaveRequest.getStatus());

        return leaveRequestRepository.save(existingRequest);
    }

    public void deleteLeaveRequest(String id) {
        leaveRequestRepository.deleteById(id);
    }
}