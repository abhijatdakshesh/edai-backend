-- Creates per-service databases and required extensions.
-- Executed automatically by docker-compose via the initdb.d mount.

-- RV Trust (original) databases
CREATE DATABASE identity_db;
CREATE DATABASE attendance_db;
CREATE DATABASE academics_db;
CREATE DATABASE fees_db;
CREATE DATABASE comms_db;
CREATE DATABASE mentorship_db;
CREATE DATABASE placements_db;
CREATE DATABASE grievance_db;
CREATE DATABASE compliance_db;
CREATE DATABASE analytics_db;
CREATE DATABASE sap_bridge_db;

-- EdAI service databases
CREATE DATABASE assignments_db;
CREATE DATABASE communications_db;
CREATE DATABASE finance_db;
CREATE DATABASE behavior_db;
CREATE DATABASE chatbot_db;

-- Shared infrastructure
CREATE DATABASE keycloak;

-- Enable extensions in each database
\connect identity_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

\connect attendance_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect academics_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

\connect fees_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect comms_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect assignments_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect communications_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect finance_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect behavior_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

\connect chatbot_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

\connect analytics_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
