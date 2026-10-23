package com.odleave.backend.repository;

import com.odleave.backend.entity.Attendance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AttendanceRepository extends MongoRepository<Attendance, String> {
    Attendance findByStudentId(String studentId);
}