package com.odleave.backend.repository;

import com.odleave.backend.entity.LeaveRequest;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface LeaveRequestRepository extends MongoRepository<LeaveRequest, String> {
}