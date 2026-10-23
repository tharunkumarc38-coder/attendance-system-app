package com.odleave.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        // Force the MongoDB Atlas cloud URI directly so it never falls back to localhost
        System.setProperty("spring.data.mongodb.uri", "mongodb+srv://tharunkumarc38_db_user:Tharunkumarc38%4025112006@cluster0.2pza0iw.mongodb.net/odleave?retryWrites=true&w=majority");
        
        SpringApplication.run(BackendApplication.class, args);
    }
}