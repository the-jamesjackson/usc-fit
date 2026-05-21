# USC-Fit — Campus Activities Web App

A full-stack web application for USC students to discover, create, and join campus fitness and recreational activities.

## Features

- **Authentication** — Register/login with USC email, security question recovery, password reset
- **Guest access** — Browse public events without an account
- **Event management** — Create, join, and manage public or private fitness events with location, date, time, and participant caps
- **Player matching** — Scored algorithm that pairs users by interest overlap (40 pts), schedule availability (30 pts), skill level (20 pts), and preferred locations (10 pts), with a rating deduction for low-rated users
- **Invitations** — Invite other registered users to private events
- **Availability scheduling** — Set weekly availability blocks used by the matching engine
- **Attendance & appeals** — Hosts finalize attendance after events; participants can appeal incorrect markings
- **User ratings** — Rate other participants after shared events; average rating affects match score
- **Facility reviews** — Browse and rate USC fitness facilities (Lyon Center, Village Fitness, Uytengsu Aquatics, etc.)
- **Penalty system** — Users who miss events accumulate penalties; penalized accounts are restricted from creating events and excluded from match results
- **Profile page** — View activity history, interests, skill level, preferred locations, and stats

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 11 Servlets (javax.servlet 4.0) |
| Frontend | HTML/CSS/JavaScript |
| Data | MySQL 8 |
| Serialization | Gson 2.10 |
| Build | Maven 3, packaged as WAR |
| Server | Apache Tomcat |

## Project Structure

```
CampusActivities/
├── src/main/java/com/usc/campusactivities/
│   ├── MatchingEngine.java       # Scored user-matching algorithm
│   ├── EventServlet.java         # Event CRUD + join/leave
│   ├── UserServlet.java          # User lookup and invite flow
│   ├── ProfileServlet.java       # Profile and activity history
│   ├── AppealServlet.java        # Attendance appeal workflow
│   ├── MatchServlet.java         # Match endpoint
│   ├── FacilityReviewServlet.java
│   ├── RatingServlet.java
│   ├── LoginServlet.java / RegisterServlet.java / LogoutServlet.java
│   ├── RecoveryServlet.java      # Security-question password reset
│   ├── AvailabilityServlet.java
│   ├── StatsServlet.java
│   ├── DBUtil.java               # JDBC connection helper
│   └── PasswordUtil.java         # PBKDF2 hashing
└── src/main/webapp/
    ├── index.html / login.html / register.html / recovery.html
    ├── dashboard.html            # Main feed
    ├── activities.html           # Browse/join events
    ├── createEvent.html
    ├── matching.html
    ├── profile.html
    ├── locations.html            # Facility browser + reviews
    └── appeal.html
schema.sql                        # Full DB schema + seed data
```

## Setup

**Requirements:** Java 11+, Maven, MySQL 8, Apache Tomcat 9+

### 1. Database

```sql
mysql -u root -p < CampusActivities/schema.sql
```

This creates the `campusactivities` database, all tables, seed facilities, and 12 test users.

### 2. Configure DB connection

Edit `src/main/java/com/usc/campusactivities/DBUtil.java` and set your MySQL host, port, username, and password.

### 3. Build

```bash
cd CampusActivities
mvn clean package
```

### 4. Deploy

Copy `target/CampusActivities.war` to your Tomcat `webapps/` directory and start Tomcat.

```
http://localhost:8080/CampusActivities/
```

## Test Accounts

The schema seeds 12 test users with varied interests, skill levels, and availability — useful for testing the matching engine. All share the password `testpass123`.

| Username | Interests | Skill |
|---|---|---|
| sam_swim | swimming, yoga, pilates, running | beginner |
| riley_run | running, soccer, basketball, swimming | intermediate |
| morgan_lift | weightlifting, basketball, running, yoga | competitive |
| casey_yoga | yoga, pilates, swimming, mindfulness | beginner |
| jordan_ball | basketball, volleyball, soccer, running | intermediate |
| quinn_core | pilates, yoga, weightlifting | competitive |

A `guest` account is also seeded for unauthenticated browsing.

## Acknowledgments

Originally developed as a team project for CSCI 201 at USC. This repository reflects my personal branch of the codebase, which I developed and maintained independently. See Contributors for the full team.
