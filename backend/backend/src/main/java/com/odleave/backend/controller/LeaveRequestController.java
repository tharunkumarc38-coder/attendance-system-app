package com.odleave.backend.controller;

import com.odleave.backend.entity.LeaveRequest;
import com.odleave.backend.service.LeaveRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leave-requests")
@CrossOrigin(origins = "http://localhost:5173")
public class LeaveRequestController {

    private final LeaveRequestService leaveRequestService;

    public LeaveRequestController(LeaveRequestService leaveRequestService) {
        this.leaveRequestService = leaveRequestService;
    }

    @PostMapping
    public ResponseEntity<LeaveRequest> createLeaveRequest(
            @RequestBody LeaveRequest leaveRequest) {

        return ResponseEntity.ok(
                leaveRequestService.createLeaveRequest(leaveRequest)
        );
    }

    @GetMapping
    public ResponseEntity<List<LeaveRequest>> getAllLeaveRequests() {

        return ResponseEntity.ok(
                leaveRequestService.getAllLeaveRequests()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<LeaveRequest> getLeaveRequestById(
            @PathVariable String id) {

        LeaveRequest leaveRequest =
                leaveRequestService.getLeaveRequestById(id);

        if (leaveRequest == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(leaveRequest);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LeaveRequest> updateLeaveRequest(
            @PathVariable String id,
            @RequestBody LeaveRequest leaveRequest) {

        LeaveRequest updatedRequest =
                leaveRequestService.updateLeaveRequest(id, leaveRequest);

        if (updatedRequest == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(updatedRequest);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLeaveRequest(
            @PathVariable String id) {

        leaveRequestService.deleteLeaveRequest(id);

        return ResponseEntity.noContent().build();
    }
}