package com.odleave.backend.service;

import com.odleave.backend.entity.Attendance;
import com.odleave.backend.repository.AttendanceRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;

    public AttendanceService(AttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    public Attendance createAttendance(Attendance attendance) {
        return attendanceRepository.save(attendance);
    }

    public List<Attendance> getAllAttendance() {
        return attendanceRepository.findAll();
    }

    public Attendance getAttendanceById(String id) {
        return attendanceRepository.findById(id).orElse(null);
    }

    public Attendance updateAttendance(String id, Attendance attendance) {
        Attendance existingAttendance = attendanceRepository.findById(id).orElse(null);

        if (existingAttendance == null) {
            return null;
        }

        existingAttendance.setStudentId(attendance.getStudentId());
        existingAttendance.setTotalClasses(attendance.getTotalClasses());
        existingAttendance.setAttendedClasses(attendance.getAttendedClasses());

        return attendanceRepository.save(existingAttendance);
    }

    public void deleteAttendance(String id) {
        attendanceRepository.deleteById(id);
    }

    public double getAttendancePercentage(String studentId) {
        Attendance attendance = attendanceRepository.findByStudentId(studentId);

        if (attendance == null || attendance.getTotalClasses() == 0) {
            return 0.0;
        }

        return ((double) attendance.getAttendedClasses() / attendance.getTotalClasses()) * 100;
    }
}