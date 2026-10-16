-- NAIOSH Phase 5 logical backup 2026-10-16T19-10-12-711Z
-- method=pg_dump schema-only + stats
--
-- PostgreSQL database dump
--

\restrict 786jeLlOafDmgpMuzNrssYhr8Ken9JtmPKrd3MzOf5AU21QqxZcgQefKmIAI6DO

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: phase5_restore_sandbox; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA phase5_restore_sandbox;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: update_terms_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_terms_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


--
-- Name: update_terms_sections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_terms_sections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: restore_markers; Type: TABLE; Schema: phase5_restore_sandbox; Owner: -
--

CREATE TABLE phase5_restore_sandbox.restore_markers (
    id integer NOT NULL,
    restored_at timestamp without time zone DEFAULT now() NOT NULL,
    source_artifact text,
    note text,
    checksum text
);


--
-- Name: restore_markers_id_seq; Type: SEQUENCE; Schema: phase5_restore_sandbox; Owner: -
--

CREATE SEQUENCE phase5_restore_sandbox.restore_markers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restore_markers_id_seq; Type: SEQUENCE OWNED BY; Schema: phase5_restore_sandbox; Owner: -
--

ALTER SEQUENCE phase5_restore_sandbox.restore_markers_id_seq OWNED BY phase5_restore_sandbox.restore_markers.id;


--
-- Name: accepted_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accepted_employees (
    id integer NOT NULL,
    full_name text NOT NULL,
    job_title text NOT NULL,
    email text,
    phone text,
    hire_date date NOT NULL,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: accepted_employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accepted_employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accepted_employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accepted_employees_id_seq OWNED BY public.accepted_employees.id;


--
-- Name: account_type_sidebar_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_type_sidebar_config (
    id integer NOT NULL,
    account_type character varying(50) NOT NULL,
    page_key character varying(120) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: account_type_sidebar_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_type_sidebar_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_type_sidebar_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_type_sidebar_config_id_seq OWNED BY public.account_type_sidebar_config.id;


--
-- Name: ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    level character varying(40),
    scope character varying(40),
    status character varying(40) DEFAULT 'PENDING'::character varying,
    source_entity_id character varying(120),
    entity_id character varying(120),
    source_type character varying(40),
    target_ids text[],
    cost numeric(12,2) DEFAULT 0,
    budget numeric(12,2) DEFAULT 0,
    spent numeric(12,2) DEFAULT 0,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    start_date date DEFAULT CURRENT_DATE,
    end_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: amount_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amount_adjustments (
    id text NOT NULL,
    request_date date NOT NULL,
    customer_name text NOT NULL,
    customer_contact text,
    branch_name text NOT NULL,
    previous_product text NOT NULL,
    replacement_product text NOT NULL,
    adjustment_reason text,
    price_difference numeric(14,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(6,4) DEFAULT 0.15 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_due numeric(14,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'SAR'::text NOT NULL,
    approval_status text DEFAULT 'بانتظار الموافقة'::text NOT NULL,
    workflow_stage text DEFAULT 'فتح الطلب'::text NOT NULL,
    status text NOT NULL,
    collection_method text,
    reference_no text,
    collected_by text,
    due_date date,
    notes text,
    created_by text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: amount_adjustments_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amount_adjustments_logs (
    id integer NOT NULL,
    adjustment_id text,
    action text NOT NULL,
    actor text,
    note text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: amount_adjustments_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amount_adjustments_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amount_adjustments_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amount_adjustments_logs_id_seq OWNED BY public.amount_adjustments_logs.id;


--
-- Name: approval_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_log (
    id integer NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    requested_by integer,
    approved_by integer,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    comments text,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE approval_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_log IS 'سجل طلبات الموافقة';


--
-- Name: approval_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_log_id_seq OWNED BY public.approval_log.id;


--
-- Name: approval_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_steps (
    id integer NOT NULL,
    workflow_id integer,
    step_level integer NOT NULL,
    approver_role character varying(50) NOT NULL,
    approver_id integer,
    approver_name character varying(255),
    status character varying(20) DEFAULT 'PENDING'::character varying,
    decision_date timestamp without time zone,
    comments text,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: approval_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_steps_id_seq OWNED BY public.approval_steps.id;


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id integer NOT NULL,
    entity_id character varying(40),
    item_type character varying(50) NOT NULL,
    item_id character varying(80) NOT NULL,
    item_title character varying(255),
    amount numeric(14,2) DEFAULT 0,
    current_level integer DEFAULT 1,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_by integer,
    created_by_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: approval_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_workflows_id_seq OWNED BY public.approval_workflows.id;


--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    id integer NOT NULL,
    enrollment_id integer,
    assessment_type character varying(50) NOT NULL,
    assessment_date date DEFAULT CURRENT_DATE,
    score numeric(5,2),
    max_score numeric(5,2) DEFAULT 100,
    passed boolean DEFAULT false,
    assessor_name character varying(255),
    feedback text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessments_id_seq OWNED BY public.assessments.id;


--
-- Name: attendance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_logs (
    id integer NOT NULL,
    employee_id text,
    employee_name text NOT NULL,
    department text,
    attendance_date date NOT NULL,
    shift_type text,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    work_minutes integer,
    status text DEFAULT 'pending'::text,
    decision_reason text,
    decision_at timestamp without time zone,
    notes text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    customer_number text
);


--
-- Name: attendance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_logs_id_seq OWNED BY public.attendance_logs.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    user_name character varying(100),
    entity_id character varying(20),
    action character varying(50) NOT NULL,
    resource_type character varying(50),
    resource_id character varying(100),
    old_value text,
    new_value text,
    ip_address character varying(45),
    user_agent text,
    reason text,
    status character varying(20) DEFAULT 'SUCCESS'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'سجل شامل لجميع العمليات في النظام';


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: backup_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_jobs (
    id integer NOT NULL,
    tenant_id integer,
    name character varying(255) NOT NULL,
    schedule_cron character varying(80),
    retention_days integer DEFAULT 30 NOT NULL,
    include_uploads boolean DEFAULT true NOT NULL,
    target_kind character varying(40) DEFAULT 'logical_dump'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_run_at timestamp without time zone,
    next_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT backup_jobs_target_kind_check CHECK (((target_kind)::text = ANY ((ARRAY['logical_dump'::character varying, 'script_restore_test'::character varying])::text[])))
);


--
-- Name: backup_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_jobs_id_seq OWNED BY public.backup_jobs.id;


--
-- Name: backup_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_runs (
    id integer NOT NULL,
    job_id integer,
    tenant_id integer,
    action character varying(40) NOT NULL,
    status character varying(30) DEFAULT 'running'::character varying NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at timestamp without time zone,
    artifact_path text,
    bytes bigint,
    message text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    initiated_by integer,
    CONSTRAINT backup_runs_action_check CHECK (((action)::text = ANY ((ARRAY['backup'::character varying, 'restore_test'::character varying, 'verify'::character varying])::text[]))),
    CONSTRAINT backup_runs_status_check CHECK (((status)::text = ANY ((ARRAY['running'::character varying, 'success'::character varying, 'failed'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: backup_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_runs_id_seq OWNED BY public.backup_runs.id;


--
-- Name: beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiaries (
    id integer NOT NULL,
    entity_id character varying(120),
    national_id character varying(50),
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    date_of_birth date,
    gender character varying(20),
    education_level character varying(100),
    occupation character varying(100),
    status character varying(40) DEFAULT 'ACTIVE'::character varying,
    registration_date date DEFAULT CURRENT_DATE,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: beneficiaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.beneficiaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: beneficiaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.beneficiaries_id_seq OWNED BY public.beneficiaries.id;


--
-- Name: branch_incubators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_incubators (
    id integer NOT NULL,
    branch_id character varying(120),
    incubator_id character varying(120),
    relationship_status character varying(20) DEFAULT 'ACTIVE'::character varying,
    assigned_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


--
-- Name: branch_incubators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_incubators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branch_incubators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_incubators_id_seq OWNED BY public.branch_incubators.id;


--
-- Name: branch_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_platforms (
    id integer NOT NULL,
    branch_id character varying(120),
    platform_id character varying(120),
    relationship_status character varying(20) DEFAULT 'ACTIVE'::character varying,
    assigned_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    performance_score numeric(5,2),
    monthly_revenue numeric(10,2),
    notes text
);


--
-- Name: branch_platforms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_platforms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branch_platforms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_platforms_id_seq OWNED BY public.branch_platforms.id;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    hq_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    country character varying(100),
    city character varying(100),
    address text,
    contact_email character varying(255),
    contact_phone character varying(50),
    manager_name character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    entity_id character varying(120),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id integer NOT NULL,
    enrollment_id integer,
    beneficiary_id integer,
    program_id integer,
    certificate_number character varying(100) NOT NULL,
    issue_date date DEFAULT CURRENT_DATE,
    expiry_date date,
    qr_code text,
    final_score numeric(5,2),
    grade character varying(40),
    status character varying(40) DEFAULT 'VALID'::character varying,
    issued_by character varying(255),
    verification_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.certificates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.certificates_id_seq OWNED BY public.certificates.id;


--
-- Name: community_marketing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_marketing (
    id integer NOT NULL,
    initiative_name character varying(255) NOT NULL,
    community_name character varying(255),
    target_audience character varying(255),
    participants_count integer DEFAULT 0,
    impact_score numeric(5,2),
    event_date date,
    location character varying(255),
    status character varying(50) DEFAULT 'planned'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: community_marketing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.community_marketing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: community_marketing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.community_marketing_id_seq OWNED BY public.community_marketing.id;


--
-- Name: creator_page_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_page_follows (
    follower_user_id integer NOT NULL,
    page_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: creator_page_link_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_page_link_clicks (
    id integer NOT NULL,
    page_id integer NOT NULL,
    click_key character varying(120),
    target_url text,
    viewer_user_id integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: creator_page_link_clicks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_page_link_clicks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_page_link_clicks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_page_link_clicks_id_seq OWNED BY public.creator_page_link_clicks.id;


--
-- Name: creator_page_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_page_links (
    id integer NOT NULL,
    page_id integer NOT NULL,
    label character varying(120) NOT NULL,
    url text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: creator_page_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_page_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_page_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_page_links_id_seq OWNED BY public.creator_page_links.id;


--
-- Name: creator_page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_page_views (
    id integer NOT NULL,
    page_id integer NOT NULL,
    viewer_user_id integer,
    ip_address character varying(120),
    user_agent text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: creator_page_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_page_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_page_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_page_views_id_seq OWNED BY public.creator_page_views.id;


--
-- Name: creator_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_pages (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(180) NOT NULL,
    username character varying(30) NOT NULL,
    profile_image_url text,
    cover_image_url text,
    bio text,
    phone character varying(40),
    email character varying(200),
    whatsapp text,
    facebook text,
    instagram text,
    youtube text,
    snapchat text,
    tiktok text,
    is_enabled boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: creator_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_pages_id_seq OWNED BY public.creator_pages.id;


--
-- Name: daily_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_operations (
    id integer NOT NULL,
    operation_date date NOT NULL,
    branch_id integer,
    incubator_id integer,
    platform_id integer,
    operation_type character varying(100),
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    assigned_to integer,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: daily_operations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_operations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_operations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_operations_id_seq OWNED BY public.daily_operations.id;


--
-- Name: development_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.development_programs (
    id integer NOT NULL,
    program_name character varying(255) NOT NULL,
    program_type character varying(100),
    target_audience character varying(255),
    duration_weeks integer,
    trainer character varying(255),
    capacity integer DEFAULT 20,
    enrolled integer DEFAULT 0,
    start_date date,
    completion_rate numeric(5,2) DEFAULT 0,
    status character varying(50) DEFAULT 'upcoming'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: development_programs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.development_programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: development_programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.development_programs_id_seq OWNED BY public.development_programs.id;


--
-- Name: digital_marketing_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_marketing_campaigns (
    id integer NOT NULL,
    campaign_name character varying(255) NOT NULL,
    campaign_type character varying(100) DEFAULT 'إلكتروني'::character varying,
    budget numeric(12,2),
    spent numeric(12,2) DEFAULT 0,
    reach integer DEFAULT 0,
    engagement integer DEFAULT 0,
    conversions integer DEFAULT 0,
    start_date date,
    end_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: digital_marketing_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.digital_marketing_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: digital_marketing_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.digital_marketing_campaigns_id_seq OWNED BY public.digital_marketing_campaigns.id;


--
-- Name: e_offices_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e_offices_records (
    id integer NOT NULL,
    module_key text NOT NULL,
    entity_id text DEFAULT 'HQ001'::text NOT NULL,
    entity_type text DEFAULT 'HQ'::text NOT NULL,
    row_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: e_offices_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.e_offices_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: e_offices_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.e_offices_records_id_seq OWNED BY public.e_offices_records.id;


--
-- Name: employee_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_requests (
    id character varying(50) NOT NULL,
    entity_id character varying(120),
    employee_id character varying(50),
    employee_name character varying(255) DEFAULT ''::character varying NOT NULL,
    request_type character varying(100) DEFAULT 'GENERAL'::character varying NOT NULL,
    request_title character varying(255) DEFAULT ''::character varying NOT NULL,
    description text,
    status character varying(40) DEFAULT 'PENDING'::character varying,
    priority character varying(40) DEFAULT 'NORMAL'::character varying,
    request_data jsonb,
    requires_approval boolean DEFAULT true,
    approver_id character varying(50),
    approver_name character varying(255),
    approval_date timestamp without time zone,
    approval_notes text,
    requested_date date DEFAULT CURRENT_DATE,
    start_date date,
    end_date date,
    completion_date date,
    attachments text[],
    notes text,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    current_stage character varying(40),
    workflow_stages jsonb,
    workflow_history jsonb DEFAULT '[]'::jsonb
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id integer NOT NULL,
    session_id integer,
    beneficiary_id integer,
    enrollment_date date DEFAULT CURRENT_DATE,
    status character varying(40) DEFAULT 'REGISTERED'::character varying,
    attendance_percentage numeric(5,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrollments_id_seq OWNED BY public.enrollments.id;


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entities (
    id character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(40) NOT NULL,
    status character varying(40) DEFAULT 'Active'::character varying,
    balance numeric(14,2) DEFAULT 0.00,
    location character varying(255),
    users_count integer DEFAULT 0,
    plan character varying(40) DEFAULT 'BASIC'::character varying,
    expiry_date date,
    theme character varying(40) DEFAULT 'BLUE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tenant_type character varying(50),
    tenant_id integer,
    hq_id integer,
    branch_id integer,
    incubator_id integer,
    platform_id integer,
    office_id integer
);


--
-- Name: evaluation_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_criteria (
    id integer NOT NULL,
    criteria_name character varying(255) NOT NULL,
    criteria_category character varying(100),
    weight numeric(5,2),
    description text,
    scoring_method character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: evaluation_criteria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluation_criteria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluation_criteria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluation_criteria_id_seq OWNED BY public.evaluation_criteria.id;


--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluations (
    id integer NOT NULL,
    evaluation_type character varying(100) NOT NULL,
    evaluated_entity character varying(255),
    evaluator_name character varying(255),
    evaluation_date date NOT NULL,
    score numeric(5,2),
    max_score numeric(5,2) DEFAULT 100.00,
    percentage numeric(5,2),
    strengths text,
    weaknesses text,
    recommendations text,
    status character varying(50) DEFAULT 'مكتمل'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluations_id_seq OWNED BY public.evaluations.id;


--
-- Name: event_marketing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_marketing (
    id integer NOT NULL,
    event_name character varying(255) NOT NULL,
    event_type character varying(100),
    venue character varying(255),
    event_date date,
    expected_attendees integer,
    actual_attendees integer DEFAULT 0,
    budget numeric(12,2),
    leads_generated integer DEFAULT 0,
    status character varying(50) DEFAULT 'upcoming'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: event_marketing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_marketing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_marketing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_marketing_id_seq OWNED BY public.event_marketing.id;


--
-- Name: events_studio_clips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events_studio_clips (
    id integer NOT NULL,
    entity_id text DEFAULT 'HQ001'::text NOT NULL,
    entity_type text DEFAULT 'HQ'::text NOT NULL,
    recording_id integer,
    name text NOT NULL,
    start_at integer DEFAULT 0 NOT NULL,
    end_at integer DEFAULT 0 NOT NULL,
    duration integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'جاهز'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: events_studio_clips_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_studio_clips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_studio_clips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_studio_clips_id_seq OWNED BY public.events_studio_clips.id;


--
-- Name: events_studio_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events_studio_events (
    id integer NOT NULL,
    entity_id text DEFAULT 'HQ001'::text NOT NULL,
    entity_type text DEFAULT 'HQ'::text NOT NULL,
    name text NOT NULL,
    description text,
    event_date date,
    event_time text,
    platform text,
    status text DEFAULT 'نشطة'::text NOT NULL,
    event_type text,
    speaker text,
    duration integer DEFAULT 0 NOT NULL,
    department text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: events_studio_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_studio_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_studio_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_studio_events_id_seq OWNED BY public.events_studio_events.id;


--
-- Name: events_studio_publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events_studio_publications (
    id integer NOT NULL,
    entity_id text DEFAULT 'HQ001'::text NOT NULL,
    entity_type text DEFAULT 'HQ'::text NOT NULL,
    clip_id integer,
    platforms text[] DEFAULT '{}'::text[] NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: events_studio_publications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_studio_publications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_studio_publications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_studio_publications_id_seq OWNED BY public.events_studio_publications.id;


--
-- Name: events_studio_recordings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events_studio_recordings (
    id integer NOT NULL,
    entity_id text DEFAULT 'HQ001'::text NOT NULL,
    entity_type text DEFAULT 'HQ'::text NOT NULL,
    event_id integer,
    name text,
    recording_date date,
    duration integer DEFAULT 0 NOT NULL,
    owner text,
    content_title text,
    content_description text,
    target_platform text,
    content_type text,
    campaign_department text,
    media_category text DEFAULT 'video'::text NOT NULL,
    file_type text,
    mime_type text,
    file_path text,
    original_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: events_studio_recordings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_studio_recordings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_studio_recordings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_studio_recordings_id_seq OWNED BY public.events_studio_recordings.id;


--
-- Name: exchange_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_logs (
    id integer NOT NULL,
    request_id text,
    action text NOT NULL,
    actor text,
    note text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exchange_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exchange_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exchange_logs_id_seq OWNED BY public.exchange_logs.id;


--
-- Name: exchange_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_requests (
    id text NOT NULL,
    request_date date NOT NULL,
    customer_name text NOT NULL,
    branch_name text NOT NULL,
    product_name text NOT NULL,
    serial_number text NOT NULL,
    exchange_type text NOT NULL,
    reason text NOT NULL,
    warranty_status text NOT NULL,
    priority text NOT NULL,
    technical_result text NOT NULL,
    approval_status text NOT NULL,
    exchange_cost numeric(14,2) DEFAULT 0 NOT NULL,
    owner_name text NOT NULL,
    delivery_date date,
    workflow_stage text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: executive_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_goals (
    id integer NOT NULL,
    goal_title character varying(255) NOT NULL,
    description text,
    target_date date,
    completion_percentage numeric(5,2) DEFAULT 0,
    status character varying(50) DEFAULT 'in_progress'::character varying,
    assigned_to integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: executive_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.executive_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: executive_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.executive_goals_id_seq OWNED BY public.executive_goals.id;


--
-- Name: executive_kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_kpis (
    id integer NOT NULL,
    metric_name character varying(255) NOT NULL,
    metric_value numeric(10,2) NOT NULL,
    target_value numeric(10,2),
    metric_unit character varying(50),
    period character varying(50) DEFAULT 'شهري'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: executive_kpis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.executive_kpis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: executive_kpis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.executive_kpis_id_seq OWNED BY public.executive_kpis.id;


--
-- Name: executive_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_operations (
    id integer NOT NULL,
    operation_name character varying(255) NOT NULL,
    operation_type character varying(100),
    description text,
    status character varying(50) DEFAULT 'active'::character varying,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: executive_operations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.executive_operations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: executive_operations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.executive_operations_id_seq OWNED BY public.executive_operations.id;


--
-- Name: facilities_contract_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities_contract_logs (
    id integer NOT NULL,
    contract_id integer,
    action text NOT NULL,
    user_name text,
    note text,
    status text DEFAULT 'تم التسجيل'::text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: facilities_contract_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facilities_contract_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facilities_contract_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facilities_contract_logs_id_seq OWNED BY public.facilities_contract_logs.id;


--
-- Name: facilities_project_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities_project_contracts (
    id integer NOT NULL,
    contract_name text NOT NULL,
    partner text NOT NULL,
    expiry date,
    value_text text,
    status text DEFAULT 'قيد المراجعة'::text,
    sla_percent numeric,
    risk_level text DEFAULT 'متوسط'::text,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: facilities_project_contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facilities_project_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facilities_project_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facilities_project_contracts_id_seq OWNED BY public.facilities_project_contracts.id;


--
-- Name: finance_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_accounts (
    account_id integer NOT NULL,
    account_code character varying(20) NOT NULL,
    account_name_ar character varying(200) NOT NULL,
    account_name_en character varying(200),
    account_type character varying(50) NOT NULL,
    parent_account_id integer,
    level integer DEFAULT 1,
    is_active boolean DEFAULT true,
    is_header boolean DEFAULT false,
    normal_balance character varying(10) DEFAULT 'DEBIT'::character varying,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    office_id character varying(50),
    description text,
    notes text,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100)
);


--
-- Name: finance_journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_journal_entries (
    entry_id integer NOT NULL,
    entry_number character varying(50) NOT NULL,
    entry_date date NOT NULL,
    entry_type character varying(50) DEFAULT 'MANUAL'::character varying,
    description text NOT NULL,
    reference_number character varying(100),
    reference_type character varying(50),
    reference_id integer,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    is_posted boolean DEFAULT false,
    posted_at timestamp without time zone,
    posted_by character varying(100),
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    office_id character varying(50),
    fiscal_year integer,
    fiscal_period integer,
    is_adjusting boolean DEFAULT false,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100),
    approved_by character varying(100),
    approved_at timestamp without time zone
);


--
-- Name: finance_journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_journal_lines (
    line_id integer NOT NULL,
    entry_id integer NOT NULL,
    line_number integer NOT NULL,
    account_id integer NOT NULL,
    account_code character varying(20) NOT NULL,
    debit_amount numeric(15,2) DEFAULT 0,
    credit_amount numeric(15,2) DEFAULT 0,
    description text,
    cost_center_id integer,
    project_id integer,
    department_id integer,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_debit_credit CHECK ((((debit_amount > (0)::numeric) AND (credit_amount = (0)::numeric)) OR ((credit_amount > (0)::numeric) AND (debit_amount = (0)::numeric))))
);


--
-- Name: finance_account_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_account_balances AS
 SELECT a.account_id,
    a.account_code,
    a.account_name_ar,
    a.account_type,
    a.entity_type,
    a.entity_id,
    COALESCE(sum(jl.debit_amount), (0)::numeric) AS total_debit,
    COALESCE(sum(jl.credit_amount), (0)::numeric) AS total_credit,
        CASE
            WHEN ((a.normal_balance)::text = 'DEBIT'::text) THEN (COALESCE(sum(jl.debit_amount), (0)::numeric) - COALESCE(sum(jl.credit_amount), (0)::numeric))
            ELSE (COALESCE(sum(jl.credit_amount), (0)::numeric) - COALESCE(sum(jl.debit_amount), (0)::numeric))
        END AS balance
   FROM ((public.finance_accounts a
     LEFT JOIN public.finance_journal_lines jl ON ((a.account_id = jl.account_id)))
     LEFT JOIN public.finance_journal_entries je ON (((jl.entry_id = je.entry_id) AND (je.is_posted = true))))
  WHERE (a.is_active = true)
  GROUP BY a.account_id, a.account_code, a.account_name_ar, a.account_type, a.entity_type, a.entity_id, a.normal_balance;


--
-- Name: finance_accounts_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_accounts_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_accounts_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_accounts_account_id_seq OWNED BY public.finance_accounts.account_id;


--
-- Name: finance_ai_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_ai_forecasts (
    forecast_id integer NOT NULL,
    entity_id character varying(50) NOT NULL,
    forecast_period character varying(100) NOT NULL,
    forecast_type character varying(50) NOT NULL,
    forecast_amount numeric(15,2) NOT NULL,
    confidence_level numeric(5,4),
    ai_model character varying(100),
    ai_insights jsonb,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_ai_forecasts_forecast_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_ai_forecasts_forecast_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_ai_forecasts_forecast_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_ai_forecasts_forecast_id_seq OWNED BY public.finance_ai_forecasts.forecast_id;


--
-- Name: finance_ai_risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_ai_risk_scores (
    risk_id integer NOT NULL,
    customer_id integer,
    assessment_date date NOT NULL,
    risk_score integer NOT NULL,
    risk_level character varying(20) NOT NULL,
    risk_factors jsonb,
    calculation_details jsonb,
    recommendations text,
    suggested_actions jsonb,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    entity_type character varying(20),
    entity_id character varying(50),
    model_version character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_ai_risk_scores_risk_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_ai_risk_scores_risk_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_ai_risk_scores_risk_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_ai_risk_scores_risk_id_seq OWNED BY public.finance_ai_risk_scores.risk_id;


--
-- Name: finance_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_customers (
    customer_id integer NOT NULL,
    customer_code character varying(50) NOT NULL,
    customer_name_ar character varying(200) NOT NULL,
    customer_name_en character varying(200),
    customer_type character varying(50) DEFAULT 'INDIVIDUAL'::character varying,
    company_name character varying(200),
    website character varying(200),
    email character varying(200),
    email_secondary character varying(200),
    phone character varying(50),
    mobile character varying(50),
    mobile_secondary character varying(50),
    address text,
    city character varying(100),
    country character varying(100) DEFAULT 'Saudi Arabia'::character varying,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    shipping_copy_billing boolean DEFAULT true,
    shipping_street_name character varying(200),
    shipping_city character varying(100),
    shipping_region character varying(100),
    shipping_postal_code character varying(20),
    tax_number character varying(50),
    commercial_registration character varying(50),
    credit_limit numeric(15,2) DEFAULT 0,
    credit_period_days integer DEFAULT 30,
    payment_terms text,
    risk_score integer DEFAULT 50,
    risk_level character varying(20) DEFAULT 'LOW'::character varying,
    risk_factors jsonb,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    program_id integer,
    is_active boolean DEFAULT true,
    is_blocked boolean DEFAULT false,
    blocked_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100)
);


--
-- Name: finance_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_invoices (
    invoice_id integer NOT NULL,
    invoice_number character varying(50) NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    customer_id integer NOT NULL,
    customer_name character varying(200),
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0,
    remaining_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    payment_status character varying(20) DEFAULT 'UNPAID'::character varying,
    allow_partial_payment boolean DEFAULT true,
    allow_installments boolean DEFAULT false,
    program_id integer,
    service_id integer,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    office_id character varying(50),
    journal_entry_id integer,
    notes text,
    terms_conditions text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100),
    cancelled_by character varying(100),
    cancelled_at timestamp without time zone,
    cancelled_reason text
);


--
-- Name: finance_ar_aging; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_ar_aging AS
 SELECT i.invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    c.customer_id,
    c.customer_code,
    c.customer_name_ar,
    i.total_amount,
    i.paid_amount,
    i.remaining_amount,
    i.status,
    (CURRENT_DATE - i.due_date) AS days_overdue,
        CASE
            WHEN (CURRENT_DATE <= i.due_date) THEN 'CURRENT'::text
            WHEN (((CURRENT_DATE - i.due_date) >= 1) AND ((CURRENT_DATE - i.due_date) <= 30)) THEN '1-30_DAYS'::text
            WHEN (((CURRENT_DATE - i.due_date) >= 31) AND ((CURRENT_DATE - i.due_date) <= 60)) THEN '31-60_DAYS'::text
            WHEN (((CURRENT_DATE - i.due_date) >= 61) AND ((CURRENT_DATE - i.due_date) <= 90)) THEN '61-90_DAYS'::text
            ELSE 'OVER_90_DAYS'::text
        END AS aging_category,
    i.entity_type,
    i.entity_id,
    i.branch_id,
    i.incubator_id
   FROM (public.finance_invoices i
     JOIN public.finance_customers c ON ((i.customer_id = c.customer_id)))
  WHERE ((i.remaining_amount > (0)::numeric) AND ((i.status)::text = ANY ((ARRAY['ISSUED'::character varying, 'PARTIAL'::character varying, 'OVERDUE'::character varying])::text[])));


--
-- Name: finance_asset_depreciation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_asset_depreciation (
    depreciation_id integer NOT NULL,
    asset_id integer NOT NULL,
    depreciation_date date NOT NULL,
    fiscal_year integer,
    fiscal_period integer,
    depreciation_amount numeric(15,2) NOT NULL,
    accumulated_depreciation numeric(15,2),
    net_book_value numeric(15,2),
    journal_entry_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_asset_depreciation_depreciation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_asset_depreciation_depreciation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_asset_depreciation_depreciation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_asset_depreciation_depreciation_id_seq OWNED BY public.finance_asset_depreciation.depreciation_id;


--
-- Name: finance_budget_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_budget_lines (
    line_id integer NOT NULL,
    budget_id integer NOT NULL,
    account_id integer NOT NULL,
    account_code character varying(20),
    account_name character varying(200),
    annual_amount numeric(15,2) DEFAULT 0 NOT NULL,
    month_1 numeric(15,2) DEFAULT 0,
    month_2 numeric(15,2) DEFAULT 0,
    month_3 numeric(15,2) DEFAULT 0,
    month_4 numeric(15,2) DEFAULT 0,
    month_5 numeric(15,2) DEFAULT 0,
    month_6 numeric(15,2) DEFAULT 0,
    month_7 numeric(15,2) DEFAULT 0,
    month_8 numeric(15,2) DEFAULT 0,
    month_9 numeric(15,2) DEFAULT 0,
    month_10 numeric(15,2) DEFAULT 0,
    month_11 numeric(15,2) DEFAULT 0,
    month_12 numeric(15,2) DEFAULT 0,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_budget_lines_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_budget_lines_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_budget_lines_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_budget_lines_line_id_seq OWNED BY public.finance_budget_lines.line_id;


--
-- Name: finance_budget_variances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_budget_variances (
    variance_id integer NOT NULL,
    fiscal_year integer NOT NULL,
    fiscal_period integer NOT NULL,
    period_name character varying(50),
    account_id integer NOT NULL,
    account_code character varying(20),
    budgeted_amount numeric(15,2) DEFAULT 0 NOT NULL,
    actual_amount numeric(15,2) DEFAULT 0 NOT NULL,
    variance_amount numeric(15,2) DEFAULT 0 NOT NULL,
    variance_percentage numeric(8,2) DEFAULT 0,
    variance_type character varying(20),
    significance_level character varying(20),
    ai_explanation text,
    ai_recommendations text,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    analyzed_at timestamp without time zone
);


--
-- Name: finance_budget_variances_variance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_budget_variances_variance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_budget_variances_variance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_budget_variances_variance_id_seq OWNED BY public.finance_budget_variances.variance_id;


--
-- Name: finance_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_budgets (
    budget_id integer NOT NULL,
    budget_code character varying(50) NOT NULL,
    budget_name_ar character varying(200) NOT NULL,
    budget_name_en character varying(200),
    budget_type character varying(50) NOT NULL,
    fiscal_year integer NOT NULL,
    scenario character varying(50) DEFAULT 'BASE'::character varying,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    program_id integer,
    description text,
    assumptions text,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    approved_by character varying(100),
    approved_at timestamp without time zone
);


--
-- Name: finance_budgets_budget_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_budgets_budget_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_budgets_budget_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_budgets_budget_id_seq OWNED BY public.finance_budgets.budget_id;


--
-- Name: finance_cashflow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_cashflow (
    cashflow_id integer NOT NULL,
    transaction_date date NOT NULL,
    fiscal_year integer,
    fiscal_period integer,
    flow_type character varying(50) NOT NULL,
    flow_category character varying(100),
    amount numeric(15,2) NOT NULL,
    flow_direction character varying(10) NOT NULL,
    description text,
    reference_type character varying(50),
    reference_id integer,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    journal_entry_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_cashflow_cashflow_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_cashflow_cashflow_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_cashflow_cashflow_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_cashflow_cashflow_id_seq OWNED BY public.finance_cashflow.cashflow_id;


--
-- Name: finance_cashflow_financing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_cashflow_financing (
    flow_id integer NOT NULL,
    entity_id character varying(50) NOT NULL,
    flow_type character varying(50) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    flow_date date NOT NULL,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_cashflow_financing_flow_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_cashflow_financing_flow_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_cashflow_financing_flow_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_cashflow_financing_flow_id_seq OWNED BY public.finance_cashflow_financing.flow_id;


--
-- Name: finance_cashflow_investing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_cashflow_investing (
    flow_id integer NOT NULL,
    entity_id character varying(50) NOT NULL,
    flow_type character varying(50) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    flow_date date NOT NULL,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_cashflow_investing_flow_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_cashflow_investing_flow_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_cashflow_investing_flow_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_cashflow_investing_flow_id_seq OWNED BY public.finance_cashflow_investing.flow_id;


--
-- Name: finance_cashflow_operating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_cashflow_operating (
    flow_id integer NOT NULL,
    entity_id character varying(50) NOT NULL,
    flow_type character varying(50) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    flow_date date NOT NULL,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_cashflow_operating_flow_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_cashflow_operating_flow_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_cashflow_operating_flow_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_cashflow_operating_flow_id_seq OWNED BY public.finance_cashflow_operating.flow_id;


--
-- Name: finance_cashflow_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_cashflow_summary AS
 SELECT flow_type,
    fiscal_year,
    fiscal_period,
    entity_type,
    entity_id,
    sum(
        CASE
            WHEN ((flow_direction)::text = 'IN'::text) THEN amount
            ELSE (0)::numeric
        END) AS cash_in,
    sum(
        CASE
            WHEN ((flow_direction)::text = 'OUT'::text) THEN amount
            ELSE (0)::numeric
        END) AS cash_out,
    sum(
        CASE
            WHEN ((flow_direction)::text = 'IN'::text) THEN amount
            ELSE (- amount)
        END) AS net_cashflow
   FROM public.finance_cashflow
  GROUP BY flow_type, fiscal_year, fiscal_period, entity_type, entity_id;


--
-- Name: finance_customers_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_customers_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_customers_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_customers_customer_id_seq OWNED BY public.finance_customers.customer_id;


--
-- Name: finance_electronic_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_electronic_signatures (
    signature_id integer NOT NULL,
    document_key text NOT NULL,
    document_type text NOT NULL,
    document_id text NOT NULL,
    owner_name text,
    document_status text,
    signature_status text DEFAULT 'غير موقع'::text,
    verified boolean DEFAULT false,
    fingerprint text,
    action text,
    user_name text,
    notes text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: finance_electronic_signatures_signature_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_electronic_signatures_signature_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_electronic_signatures_signature_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_electronic_signatures_signature_id_seq OWNED BY public.finance_electronic_signatures.signature_id;


--
-- Name: finance_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expenses (
    expense_id integer NOT NULL,
    expense_number character varying(50) NOT NULL,
    expense_date date NOT NULL,
    expense_category character varying(100) NOT NULL,
    expense_type character varying(100),
    vendor_id integer,
    vendor_name character varying(200),
    amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    journal_entry_id integer,
    invoice_number character varying(100),
    receipt_file character varying(500),
    attachments jsonb,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    approved_by character varying(100),
    approved_at timestamp without time zone
);


--
-- Name: finance_expenses_expense_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_expenses_expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_expenses_expense_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_expenses_expense_id_seq OWNED BY public.finance_expenses.expense_id;


--
-- Name: finance_fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_fixed_assets (
    asset_id integer NOT NULL,
    asset_code character varying(50) NOT NULL,
    asset_name_ar character varying(200) NOT NULL,
    asset_name_en character varying(200),
    asset_category character varying(100),
    asset_type character varying(100),
    purchase_date date NOT NULL,
    purchase_cost numeric(15,2) NOT NULL,
    salvage_value numeric(15,2) DEFAULT 0,
    depreciable_value numeric(15,2),
    depreciation_method character varying(50) DEFAULT 'STRAIGHT_LINE'::character varying,
    useful_life_years integer NOT NULL,
    useful_life_months integer,
    accumulated_depreciation numeric(15,2) DEFAULT 0,
    net_book_value numeric(15,2),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    disposal_date date,
    disposal_value numeric(15,2),
    location character varying(200),
    custodian_employee_id integer,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    office_id character varying(50),
    asset_account_id integer,
    depreciation_account_id integer,
    accumulated_depreciation_account_id integer,
    serial_number character varying(100),
    warranty_expiry_date date,
    maintenance_schedule text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100)
);


--
-- Name: finance_fixed_assets_asset_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_fixed_assets_asset_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_fixed_assets_asset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_fixed_assets_asset_id_seq OWNED BY public.finance_fixed_assets.asset_id;


--
-- Name: finance_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_invoice_lines (
    line_id integer NOT NULL,
    invoice_id integer NOT NULL,
    line_number integer NOT NULL,
    item_code character varying(50),
    item_name character varying(200) NOT NULL,
    description text,
    quantity numeric(10,2) DEFAULT 1,
    unit_price numeric(15,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_percentage numeric(5,2) DEFAULT 15,
    tax_amount numeric(15,2) DEFAULT 0,
    line_total numeric(15,2) NOT NULL,
    revenue_account_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_invoice_lines_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_invoice_lines_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_invoice_lines_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_invoice_lines_line_id_seq OWNED BY public.finance_invoice_lines.line_id;


--
-- Name: finance_invoices_invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_invoices_invoice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_invoices_invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_invoices_invoice_id_seq OWNED BY public.finance_invoices.invoice_id;


--
-- Name: finance_journal_entries_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_journal_entries_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_journal_entries_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_journal_entries_entry_id_seq OWNED BY public.finance_journal_entries.entry_id;


--
-- Name: finance_journal_lines_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_journal_lines_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_journal_lines_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_journal_lines_line_id_seq OWNED BY public.finance_journal_lines.line_id;


--
-- Name: finance_payment_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payment_allocations (
    allocation_id integer NOT NULL,
    payment_id integer NOT NULL,
    invoice_id integer NOT NULL,
    allocated_amount numeric(15,2) NOT NULL,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_allocated_positive CHECK ((allocated_amount > (0)::numeric))
);


--
-- Name: finance_payment_allocations_allocation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payment_allocations_allocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payment_allocations_allocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payment_allocations_allocation_id_seq OWNED BY public.finance_payment_allocations.allocation_id;


--
-- Name: finance_payment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payment_plans (
    plan_id integer NOT NULL,
    plan_number character varying(50) NOT NULL,
    customer_id integer NOT NULL,
    invoice_id integer,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    start_date date NOT NULL,
    end_date date,
    total_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0,
    remaining_amount numeric(15,2),
    number_of_installments integer NOT NULL,
    installment_amount numeric(15,2) NOT NULL,
    installment_frequency character varying(20) DEFAULT 'MONTHLY'::character varying,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    risk_score_at_creation integer,
    risk_level_at_creation character varying(20),
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    approved_by character varying(100),
    approved_at timestamp without time zone
);


--
-- Name: finance_payment_plans_plan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payment_plans_plan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payment_plans_plan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payment_plans_plan_id_seq OWNED BY public.finance_payment_plans.plan_id;


--
-- Name: finance_payment_system_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payment_system_records (
    id integer NOT NULL,
    record_number text NOT NULL,
    module_type text NOT NULL,
    record_date date NOT NULL,
    customer_name text NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    status text NOT NULL,
    owner_employee text NOT NULL,
    notes text,
    entity_id text DEFAULT 'HQ001'::text,
    entity_type text DEFAULT 'HQ'::text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_payment_system_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payment_system_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payment_system_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payment_system_records_id_seq OWNED BY public.finance_payment_system_records.id;


--
-- Name: finance_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payments (
    payment_id integer NOT NULL,
    payment_number character varying(50) NOT NULL,
    payment_date date NOT NULL,
    customer_id integer NOT NULL,
    customer_name character varying(200),
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    payment_amount numeric(15,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_type character varying(20) DEFAULT 'FULL'::character varying,
    bank_name character varying(100),
    check_number character varying(50),
    transaction_reference character varying(100),
    status character varying(20) DEFAULT 'PENDING'::character varying,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    journal_entry_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    approved_by character varying(100),
    approved_at timestamp without time zone
);


--
-- Name: finance_payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payments_payment_id_seq OWNED BY public.finance_payments.payment_id;


--
-- Name: finance_payroll_bank_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_bank_batches (
    batch_id integer NOT NULL,
    run_id integer NOT NULL,
    bank_name character varying(200),
    file_reference character varying(200),
    status character varying(20) DEFAULT 'GENERATED'::character varying,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp without time zone
);


--
-- Name: finance_payroll_bank_batches_batch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_bank_batches_batch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_bank_batches_batch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_bank_batches_batch_id_seq OWNED BY public.finance_payroll_bank_batches.batch_id;


--
-- Name: finance_payroll_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_components (
    component_id integer NOT NULL,
    component_code character varying(50) NOT NULL,
    component_name_ar character varying(200) NOT NULL,
    component_name_en character varying(200),
    component_type character varying(20) NOT NULL,
    calculation_method character varying(20) DEFAULT 'FIXED'::character varying,
    default_amount numeric(15,2) DEFAULT 0,
    is_taxable boolean DEFAULT false,
    is_active boolean DEFAULT true,
    entity_type character varying(20),
    entity_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_components_component_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_components_component_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_components_component_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_components_component_id_seq OWNED BY public.finance_payroll_components.component_id;


--
-- Name: finance_payroll_employee_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_employee_components (
    employee_component_id integer NOT NULL,
    employee_id integer NOT NULL,
    component_id integer NOT NULL,
    amount numeric(15,2) DEFAULT 0,
    percentage numeric(8,4),
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_employee_components_employee_component_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_employee_components_employee_component_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_employee_components_employee_component_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_employee_components_employee_component_id_seq OWNED BY public.finance_payroll_employee_components.employee_component_id;


--
-- Name: finance_payroll_employee_insurance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_employee_insurance (
    employee_insurance_id integer NOT NULL,
    employee_id integer NOT NULL,
    profile_id integer NOT NULL,
    insurance_number character varying(80),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_employee_insurance_employee_insurance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_employee_insurance_employee_insurance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_employee_insurance_employee_insurance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_employee_insurance_employee_insurance_id_seq OWNED BY public.finance_payroll_employee_insurance.employee_insurance_id;


--
-- Name: finance_payroll_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_employees (
    employee_id integer NOT NULL,
    employee_code character varying(50) NOT NULL,
    full_name_ar character varying(200) NOT NULL,
    full_name_en character varying(200),
    employment_type character varying(20) DEFAULT 'EMPLOYEE'::character varying,
    hire_date date,
    end_date date,
    base_salary numeric(15,2) DEFAULT 0,
    bank_name character varying(150),
    bank_iban character varying(60),
    bank_account character varying(60),
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    social_insurance_number character varying(80),
    insurance_number character varying(80),
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    office_id character varying(50),
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100)
);


--
-- Name: finance_payroll_employees_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_employees_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_employees_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_employees_employee_id_seq OWNED BY public.finance_payroll_employees.employee_id;


--
-- Name: finance_payroll_finance_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_finance_deductions (
    deduction_id integer NOT NULL,
    employee_id integer NOT NULL,
    partner_id integer,
    amount numeric(15,2) NOT NULL,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_finance_deductions_deduction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_finance_deductions_deduction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_finance_deductions_deduction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_finance_deductions_deduction_id_seq OWNED BY public.finance_payroll_finance_deductions.deduction_id;


--
-- Name: finance_payroll_finance_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_finance_partners (
    partner_id integer NOT NULL,
    partner_name character varying(200) NOT NULL,
    partner_type character varying(20) DEFAULT 'FINANCE'::character varying,
    contact_info text,
    is_active boolean DEFAULT true,
    entity_type character varying(20),
    entity_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_finance_partners_partner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_finance_partners_partner_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_finance_partners_partner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_finance_partners_partner_id_seq OWNED BY public.finance_payroll_finance_partners.partner_id;


--
-- Name: finance_payroll_flexible_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_flexible_rules (
    rule_id integer NOT NULL,
    rule_name_ar character varying(200) NOT NULL,
    rule_name_en character varying(200),
    max_percent_of_salary numeric(6,2) DEFAULT 0,
    min_remaining_salary numeric(15,2) DEFAULT 0,
    allow_advance boolean DEFAULT false,
    is_active boolean DEFAULT true,
    entity_type character varying(20),
    entity_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_flexible_rules_rule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_flexible_rules_rule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_flexible_rules_rule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_flexible_rules_rule_id_seq OWNED BY public.finance_payroll_flexible_rules.rule_id;


--
-- Name: finance_payroll_insurance_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_insurance_profiles (
    profile_id integer NOT NULL,
    country_code character varying(10) NOT NULL,
    profile_name character varying(200) NOT NULL,
    employee_rate numeric(8,4) DEFAULT 0,
    employer_rate numeric(8,4) DEFAULT 0,
    min_salary numeric(15,2) DEFAULT 0,
    max_salary numeric(15,2),
    effective_from date,
    effective_to date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_insurance_profiles_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_insurance_profiles_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_insurance_profiles_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_insurance_profiles_profile_id_seq OWNED BY public.finance_payroll_insurance_profiles.profile_id;


--
-- Name: finance_payroll_item_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_item_lines (
    line_id integer NOT NULL,
    item_id integer NOT NULL,
    component_id integer,
    line_type character varying(20) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text
);


--
-- Name: finance_payroll_item_lines_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_item_lines_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_item_lines_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_item_lines_line_id_seq OWNED BY public.finance_payroll_item_lines.line_id;


--
-- Name: finance_payroll_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_items (
    item_id integer NOT NULL,
    run_id integer NOT NULL,
    employee_id integer NOT NULL,
    gross_amount numeric(15,2) DEFAULT 0,
    deductions_amount numeric(15,2) DEFAULT 0,
    net_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_items_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_items_item_id_seq OWNED BY public.finance_payroll_items.item_id;


--
-- Name: finance_payroll_overtime; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_overtime (
    overtime_id integer NOT NULL,
    employee_id integer NOT NULL,
    work_date date NOT NULL,
    hours numeric(8,2) DEFAULT 0,
    rate numeric(12,2) DEFAULT 0,
    multiplier numeric(6,2) DEFAULT 1,
    amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    payroll_run_id integer,
    entity_type character varying(20),
    entity_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_overtime_overtime_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_overtime_overtime_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_overtime_overtime_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_overtime_overtime_id_seq OWNED BY public.finance_payroll_overtime.overtime_id;


--
-- Name: finance_payroll_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_runs (
    run_id integer NOT NULL,
    run_number character varying(50) NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    run_date date NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    total_gross numeric(15,2) DEFAULT 0,
    total_deductions numeric(15,2) DEFAULT 0,
    total_net numeric(15,2) DEFAULT 0,
    journal_entry_id integer,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    office_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    approved_by character varying(100),
    approved_at timestamp without time zone
);


--
-- Name: finance_payroll_runs_run_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_runs_run_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_runs_run_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_runs_run_id_seq OWNED BY public.finance_payroll_runs.run_id;


--
-- Name: finance_payroll_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_settlements (
    settlement_id integer NOT NULL,
    employee_id integer NOT NULL,
    settlement_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    payroll_run_id integer,
    entity_type character varying(20),
    entity_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_settlements_settlement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_settlements_settlement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_settlements_settlement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_settlements_settlement_id_seq OWNED BY public.finance_payroll_settlements.settlement_id;


--
-- Name: finance_payroll_wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_wallet_transactions (
    transaction_id integer NOT NULL,
    wallet_id integer NOT NULL,
    transaction_type character varying(20) NOT NULL,
    points_amount numeric(15,2) DEFAULT 0,
    value_amount numeric(15,2) DEFAULT 0,
    reference_type character varying(50),
    reference_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_wallet_transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_wallet_transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_wallet_transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_wallet_transactions_transaction_id_seq OWNED BY public.finance_payroll_wallet_transactions.transaction_id;


--
-- Name: finance_payroll_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payroll_wallets (
    wallet_id integer NOT NULL,
    employee_id integer NOT NULL,
    points_balance numeric(15,2) DEFAULT 0,
    value_balance numeric(15,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'SAR'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_payroll_wallets_wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_payroll_wallets_wallet_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_payroll_wallets_wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_payroll_wallets_wallet_id_seq OWNED BY public.finance_payroll_wallets.wallet_id;


--
-- Name: finance_plan_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_plan_installments (
    installment_id integer NOT NULL,
    plan_id integer NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    paid_date date,
    payment_id integer,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    city character varying(100),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_plan_installments_installment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_plan_installments_installment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_plan_installments_installment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_plan_installments_installment_id_seq OWNED BY public.finance_plan_installments.installment_id;


--
-- Name: finance_quick_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_quick_offers (
    id integer NOT NULL,
    offer_code text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    discount_value numeric DEFAULT 0 NOT NULL,
    start_at timestamp without time zone NOT NULL,
    end_at timestamp without time zone NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    approval_state text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'متوسط'::text,
    target_segment text,
    channels text[] DEFAULT '{}'::text[],
    budget numeric DEFAULT 0,
    expected_roi numeric DEFAULT 0,
    risk_score numeric DEFAULT 0,
    impressions integer DEFAULT 0,
    conversions integer DEFAULT 0,
    revenue numeric DEFAULT 0,
    cost numeric DEFAULT 0,
    rules jsonb DEFAULT '{}'::jsonb,
    notes text,
    street_name text,
    postal_code text,
    building_number text,
    city text,
    district text,
    national_address_number text,
    short_address text,
    entity_id text DEFAULT 'HQ001'::text,
    entity_type text DEFAULT 'HQ'::text,
    created_by text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: finance_quick_offers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_quick_offers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_quick_offers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_quick_offers_id_seq OWNED BY public.finance_quick_offers.id;


--
-- Name: finance_related_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_related_details (
    id integer NOT NULL,
    page_key text NOT NULL,
    record_id text NOT NULL,
    title text,
    notes text,
    tags text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_related_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_related_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_related_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_related_details_id_seq OWNED BY public.finance_related_details.id;


--
-- Name: finance_return_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_return_requests (
    id text NOT NULL,
    order_id text NOT NULL,
    customer text NOT NULL,
    reason text NOT NULL,
    condition text NOT NULL,
    category text NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    fee_rate numeric(6,4) DEFAULT 0 NOT NULL,
    status text NOT NULL,
    risk text NOT NULL,
    received date NOT NULL,
    channel text NOT NULL,
    inspector text NOT NULL,
    refund_type text NOT NULL,
    sla_days integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_sales_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_sales_settlements (
    settlement_id integer NOT NULL,
    settlement_number character varying(50) NOT NULL,
    period_label text,
    channel text,
    gross_amount numeric(15,2) DEFAULT 0,
    fees_amount numeric(15,2) DEFAULT 0,
    refunds_amount numeric(15,2) DEFAULT 0,
    collected_amount numeric(15,2) DEFAULT 0,
    variance_amount numeric(15,2) DEFAULT 0,
    status character varying(30) DEFAULT 'مفتوح'::character varying,
    risk_level character varying(20) DEFAULT 'منخفض'::character varying,
    owner_name text,
    customer_name text,
    priority_level character varying(20),
    cycle_days integer DEFAULT 0,
    last_update date DEFAULT CURRENT_DATE,
    notes text,
    entity_type character varying(20),
    entity_id character varying(50),
    branch_id character varying(50),
    incubator_id character varying(50),
    platform_id character varying(50),
    office_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_sales_settlements_settlement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_sales_settlements_settlement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_sales_settlements_settlement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_sales_settlements_settlement_id_seq OWNED BY public.finance_sales_settlements.settlement_id;


--
-- Name: finance_shipping_fee_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_shipping_fee_workflows (
    id integer NOT NULL,
    fee_id text NOT NULL,
    step text NOT NULL,
    status text NOT NULL,
    actor text,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_shipping_fee_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_shipping_fee_workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_shipping_fee_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_shipping_fee_workflows_id_seq OWNED BY public.finance_shipping_fee_workflows.id;


--
-- Name: finance_shipping_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_shipping_fees (
    fee_id text NOT NULL,
    fee_name text NOT NULL,
    carrier text NOT NULL,
    service_level text NOT NULL,
    zone text NOT NULL,
    weight_min numeric(10,2) DEFAULT 0 NOT NULL,
    weight_max numeric(10,2) DEFAULT 0 NOT NULL,
    base_fee numeric(14,2) DEFAULT 0 NOT NULL,
    per_kg_fee numeric(14,2) DEFAULT 0 NOT NULL,
    fuel_surcharge numeric(14,2) DEFAULT 0 NOT NULL,
    remote_area_fee numeric(14,2) DEFAULT 0 NOT NULL,
    cod_fee numeric(14,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'SAR'::text NOT NULL,
    status text DEFAULT 'مسودة'::text NOT NULL,
    sla_hours integer DEFAULT 48 NOT NULL,
    max_orders integer DEFAULT 0 NOT NULL,
    risk_level text DEFAULT 'منخفض'::text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    owner_name text,
    notes text,
    street_name text,
    postal_code text,
    building_number text,
    city text,
    district text,
    national_address_number text,
    short_address text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_signature_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_signature_logs (
    log_id integer NOT NULL,
    signature_id integer,
    document_key text NOT NULL,
    action text NOT NULL,
    user_name text,
    fingerprint text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: finance_signature_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_signature_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_signature_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_signature_logs_log_id_seq OWNED BY public.finance_signature_logs.log_id;


--
-- Name: finance_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_vendors (
    vendor_id integer NOT NULL,
    vendor_code character varying(50) NOT NULL,
    vendor_name_ar character varying(200) NOT NULL,
    vendor_name_en character varying(200),
    vendor_type character varying(50) DEFAULT 'SUPPLIER'::character varying,
    email character varying(200),
    phone character varying(50),
    mobile character varying(50),
    address text,
    city character varying(100),
    country character varying(100) DEFAULT 'Saudi Arabia'::character varying,
    street_name character varying(200),
    postal_code character varying(20),
    building_number character varying(20),
    district character varying(100),
    national_address_number character varying(50),
    short_address character varying(200),
    tax_number character varying(50),
    commercial_registration character varying(50),
    payment_terms character varying(200),
    payment_term_days integer DEFAULT 30,
    entity_type character varying(20),
    entity_id character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100)
);


--
-- Name: finance_vendors_vendor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_vendors_vendor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_vendors_vendor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_vendors_vendor_id_seq OWNED BY public.finance_vendors.vendor_id;


--
-- Name: financial_manual; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_manual (
    id integer NOT NULL,
    section_number character varying(20),
    section_title character varying(255) NOT NULL,
    section_order integer,
    content text,
    category character varying(100),
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_manual_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_manual_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_manual_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_manual_id_seq OWNED BY public.financial_manual.id;


--
-- Name: financial_news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_news (
    id integer NOT NULL,
    news_title character varying(255) NOT NULL,
    news_content text,
    priority character varying(50) DEFAULT 'normal'::character varying,
    published_date timestamp without time zone,
    expires_date timestamp without time zone,
    published_by integer,
    status character varying(50) DEFAULT 'published'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_news_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_news_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_news_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_news_id_seq OWNED BY public.financial_news.id;


--
-- Name: financial_operating_manual; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_operating_manual (
    id integer NOT NULL,
    section_title character varying(255) NOT NULL,
    section_number character varying(50),
    content text,
    version character varying(20),
    last_updated date,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_operating_manual_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_operating_manual_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_operating_manual_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_operating_manual_id_seq OWNED BY public.financial_operating_manual.id;


--
-- Name: financial_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_policies (
    id integer NOT NULL,
    policy_name character varying(255) NOT NULL,
    policy_code character varying(50),
    category character varying(100),
    description text,
    approval_threshold numeric(12,2),
    effective_date date,
    review_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: financial_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_policies_id_seq OWNED BY public.financial_policies.id;


--
-- Name: fiscal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_periods (
    id integer NOT NULL,
    fiscal_year_id integer NOT NULL,
    period_no integer NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(30) DEFAULT 'open'::character varying NOT NULL,
    closed_at timestamp without time zone,
    closed_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fiscal_periods_period_no_check CHECK (((period_no >= 1) AND (period_no <= 24))),
    CONSTRAINT fiscal_periods_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'locked'::character varying])::text[])))
);


--
-- Name: fiscal_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fiscal_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fiscal_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fiscal_periods_id_seq OWNED BY public.fiscal_periods.id;


--
-- Name: fiscal_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_years (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(30) DEFAULT 'open'::character varying NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fiscal_years_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'locked'::character varying])::text[])))
);


--
-- Name: fiscal_years_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fiscal_years_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fiscal_years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fiscal_years_id_seq OWNED BY public.fiscal_years.id;


--
-- Name: general_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.general_evaluations (
    id integer NOT NULL,
    evaluation_name character varying(255) NOT NULL,
    evaluation_type character varying(100),
    evaluator_id integer,
    evaluated_entity_type character varying(50),
    evaluated_entity_id integer,
    score numeric(5,2),
    max_score numeric(5,2) DEFAULT 100,
    grade character varying(20),
    comments text,
    evaluation_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: general_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.general_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: general_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.general_evaluations_id_seq OWNED BY public.general_evaluations.id;


--
-- Name: governance_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_rules (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    name_ar character varying(200) NOT NULL,
    rule_type character varying(50) NOT NULL,
    resource character varying(50) NOT NULL,
    conditions jsonb,
    action_required character varying(50),
    threshold_value numeric(15,2),
    approvers_required integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE governance_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.governance_rules IS 'قواعد الحوكمة والرقابة';


--
-- Name: governance_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.governance_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: governance_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.governance_rules_id_seq OWNED BY public.governance_rules.id;


--
-- Name: headquarters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.headquarters (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    country character varying(100),
    contact_email character varying(255),
    contact_phone character varying(50),
    logo_url text,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    entity_id character varying(120),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: headquarters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.headquarters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: headquarters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.headquarters_id_seq OWNED BY public.headquarters.id;


--
-- Name: hr_archive_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_archive_activity_log (
    id integer NOT NULL,
    record_id integer NOT NULL,
    module_key text NOT NULL,
    action text NOT NULL,
    actor_name text,
    actor_role text,
    details text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_archive_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_archive_activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_archive_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_archive_activity_log_id_seq OWNED BY public.hr_archive_activity_log.id;


--
-- Name: hr_asset_classifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_asset_classifications (
    id integer NOT NULL,
    serial_number text NOT NULL,
    item_name_ar text,
    item_name_en text,
    location text,
    status text,
    notes text,
    asset_type_ar text,
    asset_type_en text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_asset_classifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_asset_classifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_asset_classifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_asset_classifications_id_seq OWNED BY public.hr_asset_classifications.id;


--
-- Name: hr_asset_coding_system; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_asset_coding_system (
    id integer NOT NULL,
    code_prefix text NOT NULL,
    name_en text,
    name_ar text,
    category_ar text,
    category_en text,
    example_code text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_asset_coding_system_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_asset_coding_system_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_asset_coding_system_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_asset_coding_system_id_seq OWNED BY public.hr_asset_coding_system.id;


--
-- Name: hr_asset_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_asset_registry (
    id integer NOT NULL,
    serial_number text NOT NULL,
    asset_name text,
    description text,
    location text,
    status text,
    notes text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_asset_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_asset_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_asset_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_asset_registry_id_seq OWNED BY public.hr_asset_registry.id;


--
-- Name: hr_asset_type_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_asset_type_summary (
    id integer NOT NULL,
    asset_type_ar text,
    asset_type_en text,
    total_count integer DEFAULT 0,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_asset_type_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_asset_type_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_asset_type_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_asset_type_summary_id_seq OWNED BY public.hr_asset_type_summary.id;


--
-- Name: hr_asset_warehouse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_asset_warehouse (
    id integer NOT NULL,
    serial_number_ar text NOT NULL,
    serial_number_en text,
    asset_code_ar text,
    asset_code_en text,
    asset_name_ar text,
    asset_name_en text,
    quantity integer,
    condition_ar text,
    condition_en text,
    entry_date date,
    reason_ar text,
    reason_en text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_asset_warehouse_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_asset_warehouse_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_asset_warehouse_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_asset_warehouse_id_seq OWNED BY public.hr_asset_warehouse.id;


--
-- Name: hr_cost_optimization_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_cost_optimization_departments (
    id integer NOT NULL,
    department_name text NOT NULL,
    employee_count integer NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    avg_performance integer NOT NULL,
    efficiency_percent integer NOT NULL,
    recommendation text,
    planned_cost numeric(12,2),
    actual_cost numeric(12,2),
    overtime_waste_hours integer DEFAULT 0,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_cost_optimization_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_cost_optimization_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_cost_optimization_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_cost_optimization_departments_id_seq OWNED BY public.hr_cost_optimization_departments.id;


--
-- Name: hr_employee_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_profiles (
    id integer NOT NULL,
    employee_id text NOT NULL,
    name text NOT NULL,
    title text,
    department text,
    status text,
    hire_date date,
    manager text,
    avatar_initials text,
    photo_url text,
    intro_video_url text,
    cv_url text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_employee_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_employee_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_employee_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_employee_profiles_id_seq OWNED BY public.hr_employee_profiles.id;


--
-- Name: hr_employee_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_records (
    id integer NOT NULL,
    employee_id text NOT NULL,
    section text NOT NULL,
    status text,
    period text,
    record jsonb NOT NULL,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_employee_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_employee_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_employee_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_employee_records_id_seq OWNED BY public.hr_employee_records.id;


--
-- Name: hr_erp_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_erp_integrations (
    id integer NOT NULL,
    integration_name text NOT NULL,
    integration_type text NOT NULL,
    linked_entity text,
    status text DEFAULT 'قيد الإعداد'::text,
    owner text,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_erp_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_erp_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_erp_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_erp_integrations_id_seq OWNED BY public.hr_erp_integrations.id;


--
-- Name: hr_experience_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_experience_records (
    id integer NOT NULL,
    employee_name text NOT NULL,
    experience_type text NOT NULL,
    experience_field text NOT NULL,
    years_of_experience integer NOT NULL,
    experience_level text NOT NULL,
    added_on date DEFAULT CURRENT_DATE,
    status text DEFAULT 'قيد المراجعة'::text,
    notes text,
    skills jsonb DEFAULT '[]'::jsonb,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_experience_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_experience_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_experience_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_experience_records_id_seq OWNED BY public.hr_experience_records.id;


--
-- Name: hr_form_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_form_attachments (
    id integer NOT NULL,
    entity_id text DEFAULT 'HQ001'::text NOT NULL,
    page_path text,
    form_id text,
    original_name text NOT NULL,
    stored_name text NOT NULL,
    mime_type text,
    size_bytes bigint DEFAULT 0,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_form_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_form_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_form_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_form_attachments_id_seq OWNED BY public.hr_form_attachments.id;


--
-- Name: hr_human_risks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_human_risks (
    id integer NOT NULL,
    subject_name text NOT NULL,
    risk_type text NOT NULL,
    risk_level text NOT NULL,
    risk_reason text NOT NULL,
    proposed_action text NOT NULL,
    owner_name text NOT NULL,
    review_date date NOT NULL,
    follow_status text NOT NULL,
    entity_id text DEFAULT 'HQ001'::text,
    entity_type text DEFAULT 'HQ'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_human_risks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_human_risks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_human_risks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_human_risks_id_seq OWNED BY public.hr_human_risks.id;


--
-- Name: hr_innovation_ideas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_innovation_ideas (
    id integer NOT NULL,
    owner_name text NOT NULL,
    idea_title text NOT NULL,
    department text NOT NULL,
    innovation_type text NOT NULL,
    expected_impact text NOT NULL,
    status text DEFAULT 'جديدة'::text,
    submitted_on date DEFAULT CURRENT_DATE,
    rating numeric(3,1) DEFAULT 0,
    votes integer DEFAULT 0,
    financial_impact numeric(14,2) DEFAULT 0,
    history jsonb DEFAULT '[]'::jsonb,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_innovation_ideas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_innovation_ideas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_innovation_ideas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_innovation_ideas_id_seq OWNED BY public.hr_innovation_ideas.id;


--
-- Name: hr_learning_academy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_learning_academy (
    id integer NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    status text DEFAULT 'نشط'::text,
    owner text,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_learning_academy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_learning_academy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_learning_academy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_learning_academy_id_seq OWNED BY public.hr_learning_academy.id;


--
-- Name: hr_module_record_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_module_record_files (
    id integer NOT NULL,
    record_id integer NOT NULL,
    module_key text NOT NULL,
    original_name text NOT NULL,
    stored_name text NOT NULL,
    mime_type text,
    size_bytes integer,
    extension text,
    file_path text NOT NULL,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_module_record_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_module_record_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_module_record_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_module_record_files_id_seq OWNED BY public.hr_module_record_files.id;


--
-- Name: hr_module_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_module_records (
    id integer NOT NULL,
    module_key text NOT NULL,
    title text NOT NULL,
    department text,
    doc_number text,
    doc_type text,
    doc_category text,
    archive_date date,
    confidentiality text,
    procedure_type text,
    steps_count integer,
    owner text,
    status text DEFAULT 'قيد المراجعة'::text,
    priority text DEFAULT 'متوسط'::text,
    due_date date,
    issue_date date,
    notes text,
    keywords text,
    display_order integer,
    review_status text,
    share_status text,
    is_locked boolean DEFAULT false,
    locked_by text,
    locked_at timestamp without time zone,
    last_activity_at timestamp without time zone,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_module_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_module_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_module_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_module_records_id_seq OWNED BY public.hr_module_records.id;


--
-- Name: hr_ops_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_ops_records (
    id integer NOT NULL,
    module_key text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'نشط'::text,
    data jsonb DEFAULT '{}'::jsonb,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_ops_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_ops_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_ops_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_ops_records_id_seq OWNED BY public.hr_ops_records.id;


--
-- Name: hr_payroll_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_payroll_records (
    id integer NOT NULL,
    employee_name text NOT NULL,
    department text,
    operation_type text DEFAULT 'salary'::text,
    amount numeric(12,2) DEFAULT 0,
    base_salary numeric(12,2) DEFAULT 0,
    allowances numeric(12,2) DEFAULT 0,
    deductions numeric(12,2) DEFAULT 0,
    bonuses numeric(12,2) DEFAULT 0,
    status text DEFAULT 'قيد المعالجة'::text,
    pay_date date,
    payroll_month text,
    notes text,
    history jsonb DEFAULT '[]'::jsonb,
    adjustments jsonb DEFAULT '[]'::jsonb,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_payroll_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_payroll_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_payroll_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_payroll_records_id_seq OWNED BY public.hr_payroll_records.id;


--
-- Name: hr_performance_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_performance_evaluations (
    id integer NOT NULL,
    employee_name text NOT NULL,
    department text,
    evaluation_type text,
    evaluation_period text,
    score numeric(5,2),
    status text DEFAULT 'قيد التقييم'::text,
    evaluator_name text,
    evaluation_date date,
    strengths text[],
    improvements text[],
    manager_notes text,
    development_plan text[],
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_performance_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_performance_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_performance_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_performance_evaluations_id_seq OWNED BY public.hr_performance_evaluations.id;


--
-- Name: hr_productivity_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_productivity_records (
    id integer NOT NULL,
    employee_id text,
    employee_name text NOT NULL,
    department text NOT NULL,
    work_hours integer NOT NULL,
    overtime_hours integer DEFAULT 0,
    productivity_level integer NOT NULL,
    efficiency_percent integer NOT NULL,
    final_rating text,
    evidence_files jsonb DEFAULT '[]'::jsonb,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_productivity_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_productivity_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_productivity_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_productivity_records_id_seq OWNED BY public.hr_productivity_records.id;


--
-- Name: hr_satisfaction_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_satisfaction_analytics (
    id integer NOT NULL,
    employee_name text NOT NULL,
    department_name text NOT NULL,
    survey_type text NOT NULL,
    satisfaction_score numeric(4,2) NOT NULL,
    satisfaction_level text NOT NULL,
    evaluation_date date DEFAULT CURRENT_DATE,
    notes text,
    follow_up_status text DEFAULT 'قيد المتابعة'::text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_satisfaction_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_satisfaction_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_satisfaction_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_satisfaction_analytics_id_seq OWNED BY public.hr_satisfaction_analytics.id;


--
-- Name: hr_skills_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_skills_records (
    id integer NOT NULL,
    employee_name text NOT NULL,
    skill_name text NOT NULL,
    department text NOT NULL,
    skill_type text NOT NULL,
    skill_level text NOT NULL,
    years_experience integer DEFAULT 0 NOT NULL,
    assessment_date date NOT NULL,
    skill_status text NOT NULL,
    role_match text,
    is_core boolean DEFAULT false,
    entity_id text DEFAULT 'HQ001'::text,
    entity_type text DEFAULT 'HQ'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_skills_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_skills_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_skills_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_skills_records_id_seq OWNED BY public.hr_skills_records.id;


--
-- Name: hr_sso_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_sso_integrations (
    id integer NOT NULL,
    provider_name text NOT NULL,
    protocol text NOT NULL,
    status text DEFAULT 'غير مفعل'::text,
    domain text,
    metadata_url text,
    login_url text,
    last_sync_at timestamp without time zone,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_sso_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_sso_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_sso_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_sso_integrations_id_seq OWNED BY public.hr_sso_integrations.id;


--
-- Name: hr_strategic_monthly_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_strategic_monthly_indicators (
    id integer NOT NULL,
    month_key text NOT NULL,
    month_label text NOT NULL,
    period text,
    headcount integer NOT NULL,
    attendance_rate numeric(5,2) NOT NULL,
    turnover_rate numeric(5,2) NOT NULL,
    performance_score numeric(5,2) NOT NULL,
    new_hires integer NOT NULL,
    resignations integer NOT NULL,
    absence_rate numeric(5,2) NOT NULL,
    tardy_rate numeric(5,2) NOT NULL,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_strategic_monthly_indicators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_strategic_monthly_indicators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_strategic_monthly_indicators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_strategic_monthly_indicators_id_seq OWNED BY public.hr_strategic_monthly_indicators.id;


--
-- Name: hr_succession_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_succession_plans (
    id integer NOT NULL,
    role_title text NOT NULL,
    incumbent_name text NOT NULL,
    successor_name text,
    readiness_level text,
    development_plan text,
    review_date date,
    succession_status text DEFAULT 'قيد التطوير'::text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_succession_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_succession_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_succession_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_succession_plans_id_seq OWNED BY public.hr_succession_plans.id;


--
-- Name: hr_system_setting_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_system_setting_records (
    id integer NOT NULL,
    catalog_key text NOT NULL,
    code text,
    name text NOT NULL,
    status text DEFAULT 'نشط'::text,
    data jsonb DEFAULT '{}'::jsonb,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_system_setting_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_system_setting_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_system_setting_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_system_setting_records_id_seq OWNED BY public.hr_system_setting_records.id;


--
-- Name: hr_talent_management; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_talent_management (
    id integer NOT NULL,
    employee_name text NOT NULL,
    department text,
    core_skills text[] DEFAULT ARRAY[]::text[],
    performance_level numeric(4,2),
    potential_level numeric(4,2),
    talent_classification text DEFAULT 'متوسطة'::text,
    development_plan text,
    development_plan_status text DEFAULT 'نشطة'::text,
    last_review_date date,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_talent_management_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_talent_management_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_talent_management_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_talent_management_id_seq OWNED BY public.hr_talent_management.id;


--
-- Name: hr_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tasks (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    start_date date,
    end_date date,
    attachments jsonb DEFAULT '[]'::jsonb,
    entity_id text DEFAULT 'HQ001'::text,
    entity_type text DEFAULT 'HQ'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tasks_id_seq OWNED BY public.hr_tasks.id;


--
-- Name: hr_workforce_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_workforce_plans (
    id integer NOT NULL,
    department_name text NOT NULL,
    current_headcount integer NOT NULL,
    target_headcount integer NOT NULL,
    gap integer NOT NULL,
    hiring_plan text,
    review_date date,
    status text DEFAULT 'قيد المراجعة'::text,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: hr_workforce_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_workforce_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_workforce_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_workforce_plans_id_seq OWNED BY public.hr_workforce_plans.id;


--
-- Name: incubators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incubators (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    program_type character varying(100),
    capacity integer DEFAULT 0,
    contact_email character varying(255),
    contact_phone character varying(50),
    manager_name character varying(255),
    start_date date,
    end_date date,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    entity_id character varying(120),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: incubators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incubators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incubators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incubators_id_seq OWNED BY public.incubators.id;


--
-- Name: information_repository; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.information_repository (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(100),
    content text,
    file_path character varying(500),
    tags text,
    access_level character varying(50) DEFAULT 'public'::character varying,
    views_count integer DEFAULT 0,
    published_by integer,
    published_date timestamp without time zone,
    last_updated timestamp without time zone,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: information_repository_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.information_repository_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: information_repository_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.information_repository_id_seq OWNED BY public.information_repository.id;


--
-- Name: installment_plan_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installment_plan_types (
    id integer NOT NULL,
    plan_code character varying(50) NOT NULL,
    plan_name_ar character varying(255) NOT NULL,
    plan_name_en character varying(255),
    description_ar text,
    description_en text,
    duration_months integer NOT NULL,
    number_of_payments integer NOT NULL,
    payment_frequency character varying(50) DEFAULT 'MONTHLY'::character varying,
    interest_rate numeric(5,2) DEFAULT 0,
    admin_fee numeric(10,2) DEFAULT 0,
    late_payment_fee numeric(10,2) DEFAULT 0,
    min_amount numeric(15,2),
    max_amount numeric(15,2),
    has_grace_period boolean DEFAULT false,
    grace_period_days integer DEFAULT 0,
    early_payment_discount numeric(5,2) DEFAULT 0,
    icon character varying(20) DEFAULT 'calendar'::character varying,
    color character varying(20) DEFAULT '#3b82f6'::character varying,
    badge_text character varying(100),
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: installment_plan_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.installment_plan_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: installment_plan_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.installment_plan_types_id_seq OWNED BY public.installment_plan_types.id;


--
-- Name: integration_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_registry (
    id integer NOT NULL,
    tenant_id integer,
    integration_key character varying(80) NOT NULL,
    display_name character varying(255) NOT NULL,
    category character varying(40) DEFAULT 'other'::character varying NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    secrets_ref character varying(120),
    last_test_at timestamp without time zone,
    last_test_ok boolean,
    last_test_msg text,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: integration_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.integration_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: integration_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.integration_registry_id_seq OWNED BY public.integration_registry.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id character varying(50) NOT NULL,
    entity_id character varying(120),
    type character varying(40) DEFAULT 'SUBSCRIPTION'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0,
    status character varying(40) DEFAULT 'UNPAID'::character varying,
    issue_date date DEFAULT CURRENT_DATE,
    due_date date DEFAULT CURRENT_DATE,
    customer_name character varying(255),
    customer_number character varying(100),
    customer_phone character varying(100),
    customer_email character varying(255),
    payment_method character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base (
    id integer NOT NULL,
    topic character varying(255) NOT NULL,
    category character varying(100),
    question text,
    answer text,
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_base_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_base_id_seq OWNED BY public.knowledge_base.id;


--
-- Name: kpi_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_evaluations (
    id integer NOT NULL,
    employee_id integer,
    evaluation_period character varying(50),
    kpi_score numeric(5,2),
    performance_rating character varying(50),
    strengths text,
    areas_for_improvement text,
    evaluated_by integer,
    evaluation_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: kpi_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kpi_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kpi_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kpi_evaluations_id_seq OWNED BY public.kpi_evaluations.id;


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balances (
    id integer NOT NULL,
    employee_id text,
    employee_name text NOT NULL,
    department text,
    annual_days integer DEFAULT 0,
    used_days integer DEFAULT 0,
    pending_days integer DEFAULT 0,
    carry_over integer DEFAULT 0,
    year integer DEFAULT EXTRACT(year FROM CURRENT_DATE),
    notes text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    employee_id text,
    employee_name text NOT NULL,
    department text,
    leave_type text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count integer,
    reason text,
    status text DEFAULT 'pending'::text,
    decision_reason text,
    decision_at timestamp without time zone,
    reviewed_by text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger (
    id integer NOT NULL,
    entity_id character varying(120),
    transaction_id character varying(50),
    transaction_date date DEFAULT CURRENT_DATE,
    description text DEFAULT ''::text NOT NULL,
    debit numeric(12,2) DEFAULT 0,
    credit numeric(12,2) DEFAULT 0,
    balance numeric(14,2) DEFAULT 0,
    type character varying(40),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_id_seq OWNED BY public.ledger.id;


--
-- Name: module_numbering_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_numbering_counters (
    id integer NOT NULL,
    series_key character varying(80) NOT NULL,
    prefix character varying(40) DEFAULT ''::character varying NOT NULL,
    next_number integer DEFAULT 1 NOT NULL,
    pad_width integer DEFAULT 5 NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: module_numbering_counters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.module_numbering_counters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: module_numbering_counters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.module_numbering_counters_id_seq OWNED BY public.module_numbering_counters.id;


--
-- Name: module_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_template_versions (
    id integer NOT NULL,
    template_id integer NOT NULL,
    version integer NOT NULL,
    subject character varying(500),
    body text DEFAULT ''::text NOT NULL,
    changed_by integer,
    change_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: module_template_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.module_template_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: module_template_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.module_template_versions_id_seq OWNED BY public.module_template_versions.id;


--
-- Name: module_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_templates (
    id integer NOT NULL,
    template_type character varying(40) NOT NULL,
    code character varying(80) NOT NULL,
    name_ar character varying(255) NOT NULL,
    subject character varying(500),
    body text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT module_templates_template_type_check CHECK (((template_type)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'print'::character varying])::text[])))
);


--
-- Name: module_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.module_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: module_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.module_templates_id_seq OWNED BY public.module_templates.id;


--
-- Name: new_hires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.new_hires (
    id integer NOT NULL,
    full_name text NOT NULL,
    reference_code text NOT NULL,
    phone text,
    employee_info text,
    interview_date date NOT NULL,
    match_percent numeric,
    status text DEFAULT 'pending'::text,
    decision_reason text,
    decision_at timestamp without time zone,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: new_hires_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.new_hires_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: new_hires_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.new_hires_id_seq OWNED BY public.new_hires.id;


--
-- Name: nocode_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nocode_records (
    id integer NOT NULL,
    system_id integer NOT NULL,
    table_key character varying(100) NOT NULL,
    record_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: nocode_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nocode_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nocode_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nocode_records_id_seq OWNED BY public.nocode_records.id;


--
-- Name: nocode_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nocode_systems (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(100) DEFAULT 'fas fa-layer-group'::character varying,
    color character varying(50) DEFAULT '#7c3aed'::character varying,
    tables_config jsonb DEFAULT '[]'::jsonb NOT NULL,
    menu_item_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: nocode_systems_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nocode_systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nocode_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nocode_systems_id_seq OWNED BY public.nocode_systems.id;


--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_outbox (
    id integer NOT NULL,
    tenant_id integer,
    channel character varying(20) NOT NULL,
    recipient character varying(500) NOT NULL,
    subject character varying(500),
    body text DEFAULT ''::text NOT NULL,
    template_code character varying(80),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_attempt_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_error text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sent_at timestamp without time zone,
    CONSTRAINT notification_outbox_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'in_app'::character varying])::text[]))),
    CONSTRAINT notification_outbox_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sending'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: notification_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_outbox_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_outbox_id_seq OWNED BY public.notification_outbox.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    entity_id character varying(120),
    type character varying(50) DEFAULT 'SYSTEM'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    link_type character varying(50),
    link_id character varying(50),
    is_read boolean DEFAULT false,
    priority character varying(40) DEFAULT 'NORMAL'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: office_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office_platforms (
    id integer NOT NULL,
    office_id integer NOT NULL,
    platform_id integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: office_platforms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.office_platforms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: office_platforms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.office_platforms_id_seq OWNED BY public.office_platforms.id;


--
-- Name: offices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offices (
    id integer NOT NULL,
    incubator_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    office_type character varying(100),
    location character varying(255),
    address text,
    capacity integer DEFAULT 0,
    working_hours jsonb DEFAULT '{}'::jsonb,
    contact_email character varying(255),
    contact_phone character varying(50),
    manager_name character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    entity_id character varying(120),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: offices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offices_id_seq OWNED BY public.offices.id;


--
-- Name: operational_monitoring; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_monitoring (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    metric_name character varying(255),
    metric_value numeric(10,2),
    threshold_min numeric(10,2),
    threshold_max numeric(10,2),
    alert_status character varying(50) DEFAULT 'normal'::character varying,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: operational_monitoring_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operational_monitoring_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operational_monitoring_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operational_monitoring_id_seq OWNED BY public.operational_monitoring.id;


--
-- Name: operational_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_policies (
    id integer NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    authority text NOT NULL,
    category text NOT NULL,
    system_key text DEFAULT 'ADMIN'::text,
    issue_date date,
    version text,
    reference text,
    status text DEFAULT 'سارية'::text,
    review_date date,
    full_text text,
    download_url text,
    entity_id text DEFAULT 'HQ001'::text,
    entity_type text DEFAULT 'HQ'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: operational_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operational_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operational_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operational_policies_id_seq OWNED BY public.operational_policies.id;


--
-- Name: operational_policy_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_policy_updates (
    id integer NOT NULL,
    policy_id integer,
    title text NOT NULL,
    note text,
    update_date date,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: operational_policy_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operational_policy_updates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operational_policy_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operational_policy_updates_id_seq OWNED BY public.operational_policy_updates.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    method_code character varying(100) NOT NULL,
    method_name_ar character varying(255) NOT NULL,
    method_name_en character varying(255),
    description_ar text,
    description_en text,
    icon character varying(100),
    color character varying(50) DEFAULT '#3b82f6'::character varying,
    is_active boolean DEFAULT true,
    requires_bank_details boolean DEFAULT false,
    requires_card_details boolean DEFAULT false,
    processing_fee_percentage numeric(5,2) DEFAULT 0,
    processing_fee_fixed numeric(10,2) DEFAULT 0,
    min_amount numeric(10,2),
    max_amount numeric(10,2),
    display_order integer DEFAULT 0,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    name_ar character varying(100) NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(20) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.permissions IS 'جدول الصلاحيات والأذونات';


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: platform_api_error_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_api_error_events (
    id integer NOT NULL,
    path text,
    method character varying(10),
    status_code integer,
    error_message text,
    tenant_id integer,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_api_error_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_api_error_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_api_error_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_api_error_events_id_seq OWNED BY public.platform_api_error_events.id;


--
-- Name: platform_feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_feature_flags (
    id integer NOT NULL,
    key character varying(120) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    description_ar text,
    description_en text,
    audience character varying(40) DEFAULT 'platform'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT platform_feature_flags_audience_check CHECK (((audience)::text = ANY ((ARRAY['platform'::character varying, 'all_tenants'::character varying, 'selected'::character varying])::text[])))
);


--
-- Name: platform_feature_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_feature_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_feature_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_feature_flags_id_seq OWNED BY public.platform_feature_flags.id;


--
-- Name: platform_owner_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_owner_audit (
    id integer NOT NULL,
    actor_id integer,
    action character varying(80) NOT NULL,
    entity_type character varying(60),
    entity_id character varying(120),
    tenant_id integer,
    old_value jsonb,
    new_value jsonb,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address character varying(64),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_owner_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_owner_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_owner_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_owner_audit_id_seq OWNED BY public.platform_owner_audit.id;


--
-- Name: platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platforms (
    id integer NOT NULL,
    incubator_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    platform_type character varying(100),
    pricing_model character varying(50),
    base_price numeric(10,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'USD'::character varying,
    features jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    entity_id character varying(120),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: platforms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platforms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platforms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platforms_id_seq OWNED BY public.platforms.id;


--
-- Name: quality_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_audits (
    id integer NOT NULL,
    audit_name character varying(255) NOT NULL,
    audit_type character varying(100),
    audited_entity_type character varying(50),
    audited_entity_id integer,
    auditor_id integer,
    audit_date date,
    findings text,
    recommendations text,
    compliance_score numeric(5,2),
    status character varying(50) DEFAULT 'scheduled'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: quality_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quality_audits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quality_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quality_audits_id_seq OWNED BY public.quality_audits.id;


--
-- Name: quality_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_standards (
    id integer NOT NULL,
    standard_name character varying(255) NOT NULL,
    standard_code character varying(50),
    category character varying(100),
    description text,
    compliance_level character varying(50),
    audit_frequency character varying(50),
    last_audit_date date,
    next_audit_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: quality_standards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quality_standards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quality_standards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quality_standards_id_seq OWNED BY public.quality_standards.id;


--
-- Name: records_master_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records_master_register (
    id integer NOT NULL,
    doc_number text NOT NULL,
    doc_type text NOT NULL,
    department text NOT NULL,
    doc_date date NOT NULL,
    subject text NOT NULL,
    status text NOT NULL,
    confidentiality text NOT NULL,
    url text,
    direction text NOT NULL,
    notes text,
    source text NOT NULL,
    password text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: records_master_register_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.records_master_register_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: records_master_register_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.records_master_register_id_seq OWNED BY public.records_master_register.id;


--
-- Name: records_students_affairs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records_students_affairs (
    id integer NOT NULL,
    student_number text NOT NULL,
    student_name text NOT NULL,
    stage_department text NOT NULL,
    document_type text NOT NULL,
    status text NOT NULL,
    registration_date date NOT NULL,
    notes text,
    entity_id text,
    entity_type text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: records_students_affairs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.records_students_affairs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: records_students_affairs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.records_students_affairs_id_seq OWNED BY public.records_students_affairs.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE role_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.role_permissions IS 'ربط الأدوار بالصلاحيات';


--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    name_ar character varying(100) NOT NULL,
    description text,
    level character varying(20) NOT NULL,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    hierarchy_level integer DEFAULT 0,
    job_title_ar character varying(200),
    job_title_en character varying(200),
    max_approval_limit numeric(15,2),
    approval_notes_ar text,
    is_active boolean DEFAULT true
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.roles IS 'جدول الأدوار الوظيفية في النظام';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: saas_plan_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_plan_modules (
    id integer NOT NULL,
    plan_code character varying(80) NOT NULL,
    module_key character varying(120) NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);


--
-- Name: saas_plan_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.saas_plan_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saas_plan_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.saas_plan_modules_id_seq OWNED BY public.saas_plan_modules.id;


--
-- Name: saas_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_plans (
    id integer NOT NULL,
    code character varying(80) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    description_ar text,
    description_en text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    trial_days integer DEFAULT 0 NOT NULL,
    grace_days integer DEFAULT 3 NOT NULL,
    max_users integer DEFAULT 5 NOT NULL,
    max_storage_mb integer DEFAULT 1024 NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT saas_plans_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: saas_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.saas_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saas_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.saas_plans_id_seq OWNED BY public.saas_plans.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer,
    tenant_id integer,
    session_token character varying(255),
    ip_address text,
    user_agent text,
    expires_at timestamp without time zone
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: setting_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_audit_events (
    id integer NOT NULL,
    definition_key character varying(150),
    tenant_id integer,
    actor_id integer,
    action character varying(50) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: setting_audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.setting_audit_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: setting_audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.setting_audit_events_id_seq OWNED BY public.setting_audit_events.id;


--
-- Name: setting_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_definitions (
    id integer NOT NULL,
    key character varying(150) NOT NULL,
    scope character varying(30) NOT NULL,
    module_key character varying(100),
    data_type character varying(30) DEFAULT 'json'::character varying NOT NULL,
    default_value jsonb,
    label_ar text,
    label_en text,
    description_ar text,
    description_en text,
    validation jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_permission character varying(120),
    write_permission character varying(120),
    is_sensitive boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT setting_definitions_scope_check CHECK (((scope)::text = ANY ((ARRAY['platform'::character varying, 'plan'::character varying, 'tenant'::character varying, 'branch'::character varying, 'module'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: setting_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.setting_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: setting_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.setting_definitions_id_seq OWNED BY public.setting_definitions.id;


--
-- Name: setting_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_values (
    id integer NOT NULL,
    definition_key character varying(150) NOT NULL,
    tenant_id integer,
    branch_id integer,
    module_key character varying(100),
    value jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: setting_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.setting_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: setting_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.setting_values_id_seq OWNED BY public.setting_values.id;


--
-- Name: setting_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_versions (
    id integer NOT NULL,
    setting_value_id integer NOT NULL,
    version integer NOT NULL,
    value jsonb NOT NULL,
    changed_by integer,
    change_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: setting_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.setting_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: setting_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.setting_versions_id_seq OWNED BY public.setting_versions.id;


--
-- Name: shift_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_schedules (
    id integer NOT NULL,
    employee_id text,
    employee_name text NOT NULL,
    department text,
    work_days text[],
    off_days text[],
    shift_type text,
    shift_start time without time zone,
    shift_end time without time zone,
    status text DEFAULT 'active'::text,
    notes text,
    entity_id text DEFAULT 'HQ001'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    customer_number text
);


--
-- Name: shift_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_schedules_id_seq OWNED BY public.shift_schedules.id;


--
-- Name: skills_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills_registry (
    id integer NOT NULL,
    skill_name character varying(255) NOT NULL,
    skill_category character varying(100),
    skill_level character varying(50),
    description text,
    prerequisite character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: skills_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.skills_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: skills_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.skills_registry_id_seq OWNED BY public.skills_registry.id;


--
-- Name: studio_ad_contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_ad_contents (
    id integer NOT NULL,
    campaign_id integer,
    campaign_name character varying(255),
    ad_title character varying(500) NOT NULL,
    ad_text text NOT NULL,
    caption text DEFAULT ''::text,
    hashtags text DEFAULT ''::text,
    platform character varying(100) DEFAULT ''::character varying,
    status character varying(50) DEFAULT 'قيد المراجعة'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: studio_ad_contents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.studio_ad_contents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: studio_ad_contents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.studio_ad_contents_id_seq OWNED BY public.studio_ad_contents.id;


--
-- Name: studio_reels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_reels (
    id integer NOT NULL,
    name character varying(500) NOT NULL,
    title character varying(500) DEFAULT ''::character varying,
    description text DEFAULT ''::text,
    hashtags text DEFAULT ''::text,
    platform character varying(100) DEFAULT ''::character varying,
    source_type character varying(50) DEFAULT 'uploaded'::character varying,
    file_name character varying(500) NOT NULL,
    original_file_name character varying(500) DEFAULT ''::character varying,
    file_path text NOT NULL,
    file_type character varying(20) DEFAULT 'WEBM'::character varying,
    created_by character varying(255) DEFAULT 'فريق الاستوديو'::character varying,
    publish_status character varying(50) DEFAULT 'مسودة'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    published_at timestamp without time zone
);


--
-- Name: studio_reels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.studio_reels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: studio_reels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.studio_reels_id_seq OWNED BY public.studio_reels.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    plan character varying(100) NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    trial_ends_at timestamp without time zone,
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    provider character varying(50),
    provider_subscription_id character varying(255),
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: tax_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_settings (
    id integer NOT NULL,
    tax_code character varying(100) NOT NULL,
    tax_name_ar character varying(255) NOT NULL,
    tax_name_en character varying(255),
    description_ar text,
    description_en text,
    tax_type character varying(50) DEFAULT 'VAT'::character varying NOT NULL,
    default_rate numeric(5,2) DEFAULT 0 NOT NULL,
    branch_id integer,
    branch_name_ar character varying(255),
    branch_specific_rate numeric(5,2),
    is_active boolean DEFAULT true,
    applicable_on character varying(100) DEFAULT 'invoice'::character varying,
    calculation_method character varying(50) DEFAULT 'percentage'::character varying,
    include_in_total boolean DEFAULT true,
    is_default boolean DEFAULT false,
    priority integer DEFAULT 0,
    min_amount numeric(10,2),
    max_amount numeric(10,2),
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(50)
);


--
-- Name: tax_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tax_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tax_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tax_settings_id_seq OWNED BY public.tax_settings.id;


--
-- Name: tenant_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_branches (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    country character varying(100),
    city character varying(100),
    address text,
    manager_name character varying(255),
    phone character varying(50),
    email character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_branches_id_seq OWNED BY public.tenant_branches.id;


--
-- Name: tenant_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_departments (
    id integer NOT NULL,
    branch_id integer,
    name character varying(255) NOT NULL,
    code character varying(50),
    parent_id integer,
    manager_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_departments_id_seq OWNED BY public.tenant_departments.id;


--
-- Name: tenant_job_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_job_titles (
    id integer NOT NULL,
    title_ar character varying(255) NOT NULL,
    title_en character varying(255),
    code character varying(50),
    grade character varying(50),
    department_id integer,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_job_titles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_job_titles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_job_titles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_job_titles_id_seq OWNED BY public.tenant_job_titles.id;


--
-- Name: tenant_licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_licenses (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    plan_code character varying(80),
    seats integer DEFAULT 5 NOT NULL,
    seats_used integer DEFAULT 0 NOT NULL,
    storage_mb_limit integer DEFAULT 1024 NOT NULL,
    storage_mb_used integer DEFAULT 0 NOT NULL,
    starts_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ends_at timestamp without time zone,
    source character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT tenant_licenses_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'suspended'::character varying, 'grace'::character varying])::text[])))
);


--
-- Name: tenant_licenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_licenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_licenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_licenses_id_seq OWNED BY public.tenant_licenses.id;


--
-- Name: tenant_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_locations (
    id integer NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    location_type character varying(40) DEFAULT 'office'::character varying NOT NULL,
    branch_id integer,
    country character varying(100),
    city character varying(100),
    address text,
    timezone character varying(80),
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT tenant_locations_location_type_check CHECK (((location_type)::text = ANY ((ARRAY['office'::character varying, 'warehouse'::character varying, 'site'::character varying, 'remote'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: tenant_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_locations_id_seq OWNED BY public.tenant_locations.id;


--
-- Name: tenant_module_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_module_overrides (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    module_key character varying(120) NOT NULL,
    enabled boolean NOT NULL,
    reason text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_module_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_module_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_module_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_module_overrides_id_seq OWNED BY public.tenant_module_overrides.id;


--
-- Name: tenant_page_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_page_access (
    id integer NOT NULL,
    tenant_id integer,
    tenant_entity_id character varying(120),
    page_key character varying(120) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: tenant_page_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_page_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_page_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_page_access_id_seq OWNED BY public.tenant_page_access.id;


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    value_json jsonb,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_settings_id_seq OWNED BY public.tenant_settings.id;


--
-- Name: tenant_user_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_user_invites (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'staff'::character varying NOT NULL,
    branch_id integer,
    invited_by integer,
    token_hash character varying(128) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    accepted_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT tenant_user_invites_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'revoked'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: tenant_user_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_user_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_user_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_user_invites_id_seq OWNED BY public.tenant_user_invites.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    subdomain character varying(63) NOT NULL,
    company_name character varying(255) NOT NULL,
    subscription_plan character varying(100) DEFAULT 'basic'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending_payment'::character varying NOT NULL,
    encrypted_db_url text,
    db_name character varying(100),
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: terms_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms_rules (
    id integer NOT NULL,
    section_id integer,
    rule_text text NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: terms_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.terms_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: terms_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.terms_rules_id_seq OWNED BY public.terms_rules.id;


--
-- Name: terms_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms_sections (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: terms_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.terms_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: terms_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.terms_sections_id_seq OWNED BY public.terms_sections.id;


--
-- Name: training_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_courses (
    id integer NOT NULL,
    course_name character varying(255) NOT NULL,
    course_code character varying(50),
    duration_hours integer,
    instructor_name character varying(255),
    max_participants integer DEFAULT 30,
    current_participants integer DEFAULT 0,
    start_date date,
    end_date date,
    price numeric(10,2),
    status character varying(50) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: training_courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_courses_id_seq OWNED BY public.training_courses.id;


--
-- Name: training_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_evaluations (
    id integer NOT NULL,
    program_id integer,
    participant_id integer,
    attendance_rate numeric(5,2),
    performance_score numeric(5,2),
    feedback text,
    certification_awarded boolean DEFAULT false,
    evaluation_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: training_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_evaluations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_evaluations_id_seq OWNED BY public.training_evaluations.id;


--
-- Name: training_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_programs (
    id integer NOT NULL,
    entity_id character varying(120),
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    duration_hours integer DEFAULT 0 NOT NULL,
    max_participants integer DEFAULT 30,
    price numeric(10,2) DEFAULT 0,
    passing_score integer DEFAULT 70,
    certificate_validity_months integer DEFAULT 12,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: training_programs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_programs_id_seq OWNED BY public.training_programs.id;


--
-- Name: training_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_sessions (
    id integer NOT NULL,
    program_id integer,
    entity_id character varying(120),
    session_code character varying(50) NOT NULL,
    session_name character varying(255) NOT NULL,
    start_date date DEFAULT CURRENT_DATE,
    end_date date DEFAULT CURRENT_DATE,
    location character varying(255),
    instructor_name character varying(255),
    max_participants integer DEFAULT 30,
    current_participants integer DEFAULT 0,
    status character varying(40) DEFAULT 'PLANNED'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: training_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_sessions_id_seq OWNED BY public.training_sessions.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id character varying(50) NOT NULL,
    invoice_id character varying(50),
    entity_id character varying(120),
    type character varying(40) DEFAULT 'PAYMENT'::character varying NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method character varying(100),
    transaction_date date DEFAULT CURRENT_DATE,
    reference_code character varying(100),
    user_name character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credentials (
    id integer NOT NULL,
    user_id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    failed_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_credentials_id_seq OWNED BY public.user_credentials.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    entity_id character varying(20),
    granted_by integer,
    granted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_roles IS 'ربط المستخدمين بالأدوار والنطاق';


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_token character varying(255) NOT NULL,
    ip_address character varying(50),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_activity timestamp without time zone DEFAULT now()
);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    role character varying(100) DEFAULT 'مسؤول النظام'::character varying NOT NULL,
    tenant_type character varying(40) DEFAULT 'HQ'::character varying NOT NULL,
    entity_id character varying(120),
    entity_name character varying(255),
    job_title character varying(255),
    office_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    first_name character varying(255),
    last_name character varying(255),
    username character varying(255),
    password_hash text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wf_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_definitions (
    id integer NOT NULL,
    tenant_id integer,
    code character varying(80) NOT NULL,
    name_ar character varying(255) NOT NULL,
    name_en character varying(255),
    module_key character varying(80) DEFAULT 'hr'::character varying NOT NULL,
    entity_type character varying(80) DEFAULT 'employee_request'::character varying NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    escalate_hours integer DEFAULT 48 NOT NULL,
    allow_skip boolean DEFAULT false NOT NULL,
    allow_return boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: wf_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wf_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wf_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wf_definitions_id_seq OWNED BY public.wf_definitions.id;


--
-- Name: wf_instance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_instance_events (
    id integer NOT NULL,
    instance_id integer NOT NULL,
    step_index integer,
    action character varying(40) NOT NULL,
    actor_id integer,
    actor_name character varying(255),
    actor_role character varying(80),
    notes text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: wf_instance_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wf_instance_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wf_instance_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wf_instance_events_id_seq OWNED BY public.wf_instance_events.id;


--
-- Name: wf_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_instances (
    id integer NOT NULL,
    tenant_id integer,
    definition_id integer,
    definition_code character varying(80),
    entity_type character varying(80) NOT NULL,
    entity_id character varying(120) NOT NULL,
    title character varying(500),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    steps_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    escalated_at timestamp without time zone,
    created_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT wf_instances_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'approved'::character varying, 'rejected'::character varying, 'returned'::character varying, 'escalated'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: wf_instances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wf_instances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wf_instances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wf_instances_id_seq OWNED BY public.wf_instances.id;


--
-- Name: restore_markers id; Type: DEFAULT; Schema: phase5_restore_sandbox; Owner: -
--

ALTER TABLE ONLY phase5_restore_sandbox.restore_markers ALTER COLUMN id SET DEFAULT nextval('phase5_restore_sandbox.restore_markers_id_seq'::regclass);


--
-- Name: accepted_employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accepted_employees ALTER COLUMN id SET DEFAULT nextval('public.accepted_employees_id_seq'::regclass);


--
-- Name: account_type_sidebar_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_type_sidebar_config ALTER COLUMN id SET DEFAULT nextval('public.account_type_sidebar_config_id_seq'::regclass);


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: amount_adjustments_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amount_adjustments_logs ALTER COLUMN id SET DEFAULT nextval('public.amount_adjustments_logs_id_seq'::regclass);


--
-- Name: approval_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_log ALTER COLUMN id SET DEFAULT nextval('public.approval_log_id_seq'::regclass);


--
-- Name: approval_steps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps ALTER COLUMN id SET DEFAULT nextval('public.approval_steps_id_seq'::regclass);


--
-- Name: approval_workflows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows ALTER COLUMN id SET DEFAULT nextval('public.approval_workflows_id_seq'::regclass);


--
-- Name: assessments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments ALTER COLUMN id SET DEFAULT nextval('public.assessments_id_seq'::regclass);


--
-- Name: attendance_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs ALTER COLUMN id SET DEFAULT nextval('public.attendance_logs_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: backup_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_jobs ALTER COLUMN id SET DEFAULT nextval('public.backup_jobs_id_seq'::regclass);


--
-- Name: backup_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_runs ALTER COLUMN id SET DEFAULT nextval('public.backup_runs_id_seq'::regclass);


--
-- Name: beneficiaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries ALTER COLUMN id SET DEFAULT nextval('public.beneficiaries_id_seq'::regclass);


--
-- Name: branch_incubators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_incubators ALTER COLUMN id SET DEFAULT nextval('public.branch_incubators_id_seq'::regclass);


--
-- Name: branch_platforms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_platforms ALTER COLUMN id SET DEFAULT nextval('public.branch_platforms_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates ALTER COLUMN id SET DEFAULT nextval('public.certificates_id_seq'::regclass);


--
-- Name: community_marketing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_marketing ALTER COLUMN id SET DEFAULT nextval('public.community_marketing_id_seq'::regclass);


--
-- Name: creator_page_link_clicks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_link_clicks ALTER COLUMN id SET DEFAULT nextval('public.creator_page_link_clicks_id_seq'::regclass);


--
-- Name: creator_page_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_links ALTER COLUMN id SET DEFAULT nextval('public.creator_page_links_id_seq'::regclass);


--
-- Name: creator_page_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_views ALTER COLUMN id SET DEFAULT nextval('public.creator_page_views_id_seq'::regclass);


--
-- Name: creator_pages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages ALTER COLUMN id SET DEFAULT nextval('public.creator_pages_id_seq'::regclass);


--
-- Name: daily_operations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_operations ALTER COLUMN id SET DEFAULT nextval('public.daily_operations_id_seq'::regclass);


--
-- Name: development_programs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_programs ALTER COLUMN id SET DEFAULT nextval('public.development_programs_id_seq'::regclass);


--
-- Name: digital_marketing_campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_marketing_campaigns ALTER COLUMN id SET DEFAULT nextval('public.digital_marketing_campaigns_id_seq'::regclass);


--
-- Name: e_offices_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e_offices_records ALTER COLUMN id SET DEFAULT nextval('public.e_offices_records_id_seq'::regclass);


--
-- Name: enrollments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments ALTER COLUMN id SET DEFAULT nextval('public.enrollments_id_seq'::regclass);


--
-- Name: evaluation_criteria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_criteria ALTER COLUMN id SET DEFAULT nextval('public.evaluation_criteria_id_seq'::regclass);


--
-- Name: evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations ALTER COLUMN id SET DEFAULT nextval('public.evaluations_id_seq'::regclass);


--
-- Name: event_marketing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_marketing ALTER COLUMN id SET DEFAULT nextval('public.event_marketing_id_seq'::regclass);


--
-- Name: events_studio_clips id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_clips ALTER COLUMN id SET DEFAULT nextval('public.events_studio_clips_id_seq'::regclass);


--
-- Name: events_studio_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_events ALTER COLUMN id SET DEFAULT nextval('public.events_studio_events_id_seq'::regclass);


--
-- Name: events_studio_publications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_publications ALTER COLUMN id SET DEFAULT nextval('public.events_studio_publications_id_seq'::regclass);


--
-- Name: events_studio_recordings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_recordings ALTER COLUMN id SET DEFAULT nextval('public.events_studio_recordings_id_seq'::regclass);


--
-- Name: exchange_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_logs ALTER COLUMN id SET DEFAULT nextval('public.exchange_logs_id_seq'::regclass);


--
-- Name: executive_goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_goals ALTER COLUMN id SET DEFAULT nextval('public.executive_goals_id_seq'::regclass);


--
-- Name: executive_kpis id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_kpis ALTER COLUMN id SET DEFAULT nextval('public.executive_kpis_id_seq'::regclass);


--
-- Name: executive_operations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_operations ALTER COLUMN id SET DEFAULT nextval('public.executive_operations_id_seq'::regclass);


--
-- Name: facilities_contract_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities_contract_logs ALTER COLUMN id SET DEFAULT nextval('public.facilities_contract_logs_id_seq'::regclass);


--
-- Name: facilities_project_contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities_project_contracts ALTER COLUMN id SET DEFAULT nextval('public.facilities_project_contracts_id_seq'::regclass);


--
-- Name: finance_accounts account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts ALTER COLUMN account_id SET DEFAULT nextval('public.finance_accounts_account_id_seq'::regclass);


--
-- Name: finance_ai_forecasts forecast_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_ai_forecasts ALTER COLUMN forecast_id SET DEFAULT nextval('public.finance_ai_forecasts_forecast_id_seq'::regclass);


--
-- Name: finance_ai_risk_scores risk_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_ai_risk_scores ALTER COLUMN risk_id SET DEFAULT nextval('public.finance_ai_risk_scores_risk_id_seq'::regclass);


--
-- Name: finance_asset_depreciation depreciation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_asset_depreciation ALTER COLUMN depreciation_id SET DEFAULT nextval('public.finance_asset_depreciation_depreciation_id_seq'::regclass);


--
-- Name: finance_budget_lines line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_lines ALTER COLUMN line_id SET DEFAULT nextval('public.finance_budget_lines_line_id_seq'::regclass);


--
-- Name: finance_budget_variances variance_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_variances ALTER COLUMN variance_id SET DEFAULT nextval('public.finance_budget_variances_variance_id_seq'::regclass);


--
-- Name: finance_budgets budget_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budgets ALTER COLUMN budget_id SET DEFAULT nextval('public.finance_budgets_budget_id_seq'::regclass);


--
-- Name: finance_cashflow cashflow_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow ALTER COLUMN cashflow_id SET DEFAULT nextval('public.finance_cashflow_cashflow_id_seq'::regclass);


--
-- Name: finance_cashflow_financing flow_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow_financing ALTER COLUMN flow_id SET DEFAULT nextval('public.finance_cashflow_financing_flow_id_seq'::regclass);


--
-- Name: finance_cashflow_investing flow_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow_investing ALTER COLUMN flow_id SET DEFAULT nextval('public.finance_cashflow_investing_flow_id_seq'::regclass);


--
-- Name: finance_cashflow_operating flow_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow_operating ALTER COLUMN flow_id SET DEFAULT nextval('public.finance_cashflow_operating_flow_id_seq'::regclass);


--
-- Name: finance_customers customer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers ALTER COLUMN customer_id SET DEFAULT nextval('public.finance_customers_customer_id_seq'::regclass);


--
-- Name: finance_electronic_signatures signature_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_electronic_signatures ALTER COLUMN signature_id SET DEFAULT nextval('public.finance_electronic_signatures_signature_id_seq'::regclass);


--
-- Name: finance_expenses expense_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expenses ALTER COLUMN expense_id SET DEFAULT nextval('public.finance_expenses_expense_id_seq'::regclass);


--
-- Name: finance_fixed_assets asset_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets ALTER COLUMN asset_id SET DEFAULT nextval('public.finance_fixed_assets_asset_id_seq'::regclass);


--
-- Name: finance_invoice_lines line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoice_lines ALTER COLUMN line_id SET DEFAULT nextval('public.finance_invoice_lines_line_id_seq'::regclass);


--
-- Name: finance_invoices invoice_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoices ALTER COLUMN invoice_id SET DEFAULT nextval('public.finance_invoices_invoice_id_seq'::regclass);


--
-- Name: finance_journal_entries entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_entries ALTER COLUMN entry_id SET DEFAULT nextval('public.finance_journal_entries_entry_id_seq'::regclass);


--
-- Name: finance_journal_lines line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines ALTER COLUMN line_id SET DEFAULT nextval('public.finance_journal_lines_line_id_seq'::regclass);


--
-- Name: finance_payment_allocations allocation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_allocations ALTER COLUMN allocation_id SET DEFAULT nextval('public.finance_payment_allocations_allocation_id_seq'::regclass);


--
-- Name: finance_payment_plans plan_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_plans ALTER COLUMN plan_id SET DEFAULT nextval('public.finance_payment_plans_plan_id_seq'::regclass);


--
-- Name: finance_payment_system_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_system_records ALTER COLUMN id SET DEFAULT nextval('public.finance_payment_system_records_id_seq'::regclass);


--
-- Name: finance_payments payment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments ALTER COLUMN payment_id SET DEFAULT nextval('public.finance_payments_payment_id_seq'::regclass);


--
-- Name: finance_payroll_bank_batches batch_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_bank_batches ALTER COLUMN batch_id SET DEFAULT nextval('public.finance_payroll_bank_batches_batch_id_seq'::regclass);


--
-- Name: finance_payroll_components component_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_components ALTER COLUMN component_id SET DEFAULT nextval('public.finance_payroll_components_component_id_seq'::regclass);


--
-- Name: finance_payroll_employee_components employee_component_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_components ALTER COLUMN employee_component_id SET DEFAULT nextval('public.finance_payroll_employee_components_employee_component_id_seq'::regclass);


--
-- Name: finance_payroll_employee_insurance employee_insurance_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_insurance ALTER COLUMN employee_insurance_id SET DEFAULT nextval('public.finance_payroll_employee_insurance_employee_insurance_id_seq'::regclass);


--
-- Name: finance_payroll_employees employee_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employees ALTER COLUMN employee_id SET DEFAULT nextval('public.finance_payroll_employees_employee_id_seq'::regclass);


--
-- Name: finance_payroll_finance_deductions deduction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_finance_deductions ALTER COLUMN deduction_id SET DEFAULT nextval('public.finance_payroll_finance_deductions_deduction_id_seq'::regclass);


--
-- Name: finance_payroll_finance_partners partner_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_finance_partners ALTER COLUMN partner_id SET DEFAULT nextval('public.finance_payroll_finance_partners_partner_id_seq'::regclass);


--
-- Name: finance_payroll_flexible_rules rule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_flexible_rules ALTER COLUMN rule_id SET DEFAULT nextval('public.finance_payroll_flexible_rules_rule_id_seq'::regclass);


--
-- Name: finance_payroll_insurance_profiles profile_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_insurance_profiles ALTER COLUMN profile_id SET DEFAULT nextval('public.finance_payroll_insurance_profiles_profile_id_seq'::regclass);


--
-- Name: finance_payroll_item_lines line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_item_lines ALTER COLUMN line_id SET DEFAULT nextval('public.finance_payroll_item_lines_line_id_seq'::regclass);


--
-- Name: finance_payroll_items item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_items ALTER COLUMN item_id SET DEFAULT nextval('public.finance_payroll_items_item_id_seq'::regclass);


--
-- Name: finance_payroll_overtime overtime_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_overtime ALTER COLUMN overtime_id SET DEFAULT nextval('public.finance_payroll_overtime_overtime_id_seq'::regclass);


--
-- Name: finance_payroll_runs run_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_runs ALTER COLUMN run_id SET DEFAULT nextval('public.finance_payroll_runs_run_id_seq'::regclass);


--
-- Name: finance_payroll_settlements settlement_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_settlements ALTER COLUMN settlement_id SET DEFAULT nextval('public.finance_payroll_settlements_settlement_id_seq'::regclass);


--
-- Name: finance_payroll_wallet_transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_wallet_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.finance_payroll_wallet_transactions_transaction_id_seq'::regclass);


--
-- Name: finance_payroll_wallets wallet_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_wallets ALTER COLUMN wallet_id SET DEFAULT nextval('public.finance_payroll_wallets_wallet_id_seq'::regclass);


--
-- Name: finance_plan_installments installment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_plan_installments ALTER COLUMN installment_id SET DEFAULT nextval('public.finance_plan_installments_installment_id_seq'::regclass);


--
-- Name: finance_quick_offers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_quick_offers ALTER COLUMN id SET DEFAULT nextval('public.finance_quick_offers_id_seq'::regclass);


--
-- Name: finance_related_details id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_related_details ALTER COLUMN id SET DEFAULT nextval('public.finance_related_details_id_seq'::regclass);


--
-- Name: finance_sales_settlements settlement_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_sales_settlements ALTER COLUMN settlement_id SET DEFAULT nextval('public.finance_sales_settlements_settlement_id_seq'::regclass);


--
-- Name: finance_shipping_fee_workflows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_shipping_fee_workflows ALTER COLUMN id SET DEFAULT nextval('public.finance_shipping_fee_workflows_id_seq'::regclass);


--
-- Name: finance_signature_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_signature_logs ALTER COLUMN log_id SET DEFAULT nextval('public.finance_signature_logs_log_id_seq'::regclass);


--
-- Name: finance_vendors vendor_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_vendors ALTER COLUMN vendor_id SET DEFAULT nextval('public.finance_vendors_vendor_id_seq'::regclass);


--
-- Name: financial_manual id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_manual ALTER COLUMN id SET DEFAULT nextval('public.financial_manual_id_seq'::regclass);


--
-- Name: financial_news id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_news ALTER COLUMN id SET DEFAULT nextval('public.financial_news_id_seq'::regclass);


--
-- Name: financial_operating_manual id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_operating_manual ALTER COLUMN id SET DEFAULT nextval('public.financial_operating_manual_id_seq'::regclass);


--
-- Name: financial_policies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_policies ALTER COLUMN id SET DEFAULT nextval('public.financial_policies_id_seq'::regclass);


--
-- Name: fiscal_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods ALTER COLUMN id SET DEFAULT nextval('public.fiscal_periods_id_seq'::regclass);


--
-- Name: fiscal_years id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years ALTER COLUMN id SET DEFAULT nextval('public.fiscal_years_id_seq'::regclass);


--
-- Name: general_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_evaluations ALTER COLUMN id SET DEFAULT nextval('public.general_evaluations_id_seq'::regclass);


--
-- Name: governance_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_rules ALTER COLUMN id SET DEFAULT nextval('public.governance_rules_id_seq'::regclass);


--
-- Name: headquarters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.headquarters ALTER COLUMN id SET DEFAULT nextval('public.headquarters_id_seq'::regclass);


--
-- Name: hr_archive_activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_archive_activity_log ALTER COLUMN id SET DEFAULT nextval('public.hr_archive_activity_log_id_seq'::regclass);


--
-- Name: hr_asset_classifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_classifications ALTER COLUMN id SET DEFAULT nextval('public.hr_asset_classifications_id_seq'::regclass);


--
-- Name: hr_asset_coding_system id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_coding_system ALTER COLUMN id SET DEFAULT nextval('public.hr_asset_coding_system_id_seq'::regclass);


--
-- Name: hr_asset_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_registry ALTER COLUMN id SET DEFAULT nextval('public.hr_asset_registry_id_seq'::regclass);


--
-- Name: hr_asset_type_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_type_summary ALTER COLUMN id SET DEFAULT nextval('public.hr_asset_type_summary_id_seq'::regclass);


--
-- Name: hr_asset_warehouse id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_warehouse ALTER COLUMN id SET DEFAULT nextval('public.hr_asset_warehouse_id_seq'::regclass);


--
-- Name: hr_cost_optimization_departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cost_optimization_departments ALTER COLUMN id SET DEFAULT nextval('public.hr_cost_optimization_departments_id_seq'::regclass);


--
-- Name: hr_employee_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profiles ALTER COLUMN id SET DEFAULT nextval('public.hr_employee_profiles_id_seq'::regclass);


--
-- Name: hr_employee_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_records ALTER COLUMN id SET DEFAULT nextval('public.hr_employee_records_id_seq'::regclass);


--
-- Name: hr_erp_integrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_erp_integrations ALTER COLUMN id SET DEFAULT nextval('public.hr_erp_integrations_id_seq'::regclass);


--
-- Name: hr_experience_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_experience_records ALTER COLUMN id SET DEFAULT nextval('public.hr_experience_records_id_seq'::regclass);


--
-- Name: hr_form_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_form_attachments ALTER COLUMN id SET DEFAULT nextval('public.hr_form_attachments_id_seq'::regclass);


--
-- Name: hr_human_risks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_human_risks ALTER COLUMN id SET DEFAULT nextval('public.hr_human_risks_id_seq'::regclass);


--
-- Name: hr_innovation_ideas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_innovation_ideas ALTER COLUMN id SET DEFAULT nextval('public.hr_innovation_ideas_id_seq'::regclass);


--
-- Name: hr_learning_academy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_learning_academy ALTER COLUMN id SET DEFAULT nextval('public.hr_learning_academy_id_seq'::regclass);


--
-- Name: hr_module_record_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_module_record_files ALTER COLUMN id SET DEFAULT nextval('public.hr_module_record_files_id_seq'::regclass);


--
-- Name: hr_module_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_module_records ALTER COLUMN id SET DEFAULT nextval('public.hr_module_records_id_seq'::regclass);


--
-- Name: hr_ops_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_ops_records ALTER COLUMN id SET DEFAULT nextval('public.hr_ops_records_id_seq'::regclass);


--
-- Name: hr_payroll_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_records ALTER COLUMN id SET DEFAULT nextval('public.hr_payroll_records_id_seq'::regclass);


--
-- Name: hr_performance_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_performance_evaluations ALTER COLUMN id SET DEFAULT nextval('public.hr_performance_evaluations_id_seq'::regclass);


--
-- Name: hr_productivity_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_productivity_records ALTER COLUMN id SET DEFAULT nextval('public.hr_productivity_records_id_seq'::regclass);


--
-- Name: hr_satisfaction_analytics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_satisfaction_analytics ALTER COLUMN id SET DEFAULT nextval('public.hr_satisfaction_analytics_id_seq'::regclass);


--
-- Name: hr_skills_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_skills_records ALTER COLUMN id SET DEFAULT nextval('public.hr_skills_records_id_seq'::regclass);


--
-- Name: hr_sso_integrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_sso_integrations ALTER COLUMN id SET DEFAULT nextval('public.hr_sso_integrations_id_seq'::regclass);


--
-- Name: hr_strategic_monthly_indicators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_strategic_monthly_indicators ALTER COLUMN id SET DEFAULT nextval('public.hr_strategic_monthly_indicators_id_seq'::regclass);


--
-- Name: hr_succession_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_succession_plans ALTER COLUMN id SET DEFAULT nextval('public.hr_succession_plans_id_seq'::regclass);


--
-- Name: hr_system_setting_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_system_setting_records ALTER COLUMN id SET DEFAULT nextval('public.hr_system_setting_records_id_seq'::regclass);


--
-- Name: hr_talent_management id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_talent_management ALTER COLUMN id SET DEFAULT nextval('public.hr_talent_management_id_seq'::regclass);


--
-- Name: hr_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tasks ALTER COLUMN id SET DEFAULT nextval('public.hr_tasks_id_seq'::regclass);


--
-- Name: hr_workforce_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_workforce_plans ALTER COLUMN id SET DEFAULT nextval('public.hr_workforce_plans_id_seq'::regclass);


--
-- Name: incubators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incubators ALTER COLUMN id SET DEFAULT nextval('public.incubators_id_seq'::regclass);


--
-- Name: information_repository id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.information_repository ALTER COLUMN id SET DEFAULT nextval('public.information_repository_id_seq'::regclass);


--
-- Name: installment_plan_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plan_types ALTER COLUMN id SET DEFAULT nextval('public.installment_plan_types_id_seq'::regclass);


--
-- Name: integration_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_registry ALTER COLUMN id SET DEFAULT nextval('public.integration_registry_id_seq'::regclass);


--
-- Name: knowledge_base id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base ALTER COLUMN id SET DEFAULT nextval('public.knowledge_base_id_seq'::regclass);


--
-- Name: kpi_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_evaluations ALTER COLUMN id SET DEFAULT nextval('public.kpi_evaluations_id_seq'::regclass);


--
-- Name: leave_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger ALTER COLUMN id SET DEFAULT nextval('public.ledger_id_seq'::regclass);


--
-- Name: module_numbering_counters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_numbering_counters ALTER COLUMN id SET DEFAULT nextval('public.module_numbering_counters_id_seq'::regclass);


--
-- Name: module_template_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_template_versions ALTER COLUMN id SET DEFAULT nextval('public.module_template_versions_id_seq'::regclass);


--
-- Name: module_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_templates ALTER COLUMN id SET DEFAULT nextval('public.module_templates_id_seq'::regclass);


--
-- Name: new_hires id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.new_hires ALTER COLUMN id SET DEFAULT nextval('public.new_hires_id_seq'::regclass);


--
-- Name: nocode_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nocode_records ALTER COLUMN id SET DEFAULT nextval('public.nocode_records_id_seq'::regclass);


--
-- Name: nocode_systems id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nocode_systems ALTER COLUMN id SET DEFAULT nextval('public.nocode_systems_id_seq'::regclass);


--
-- Name: notification_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox ALTER COLUMN id SET DEFAULT nextval('public.notification_outbox_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: office_platforms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_platforms ALTER COLUMN id SET DEFAULT nextval('public.office_platforms_id_seq'::regclass);


--
-- Name: offices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices ALTER COLUMN id SET DEFAULT nextval('public.offices_id_seq'::regclass);


--
-- Name: operational_monitoring id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_monitoring ALTER COLUMN id SET DEFAULT nextval('public.operational_monitoring_id_seq'::regclass);


--
-- Name: operational_policies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_policies ALTER COLUMN id SET DEFAULT nextval('public.operational_policies_id_seq'::regclass);


--
-- Name: operational_policy_updates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_policy_updates ALTER COLUMN id SET DEFAULT nextval('public.operational_policy_updates_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: platform_api_error_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_api_error_events ALTER COLUMN id SET DEFAULT nextval('public.platform_api_error_events_id_seq'::regclass);


--
-- Name: platform_feature_flags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_feature_flags ALTER COLUMN id SET DEFAULT nextval('public.platform_feature_flags_id_seq'::regclass);


--
-- Name: platform_owner_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_owner_audit ALTER COLUMN id SET DEFAULT nextval('public.platform_owner_audit_id_seq'::regclass);


--
-- Name: platforms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platforms ALTER COLUMN id SET DEFAULT nextval('public.platforms_id_seq'::regclass);


--
-- Name: quality_audits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits ALTER COLUMN id SET DEFAULT nextval('public.quality_audits_id_seq'::regclass);


--
-- Name: quality_standards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_standards ALTER COLUMN id SET DEFAULT nextval('public.quality_standards_id_seq'::regclass);


--
-- Name: records_master_register id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records_master_register ALTER COLUMN id SET DEFAULT nextval('public.records_master_register_id_seq'::regclass);


--
-- Name: records_students_affairs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records_students_affairs ALTER COLUMN id SET DEFAULT nextval('public.records_students_affairs_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: saas_plan_modules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plan_modules ALTER COLUMN id SET DEFAULT nextval('public.saas_plan_modules_id_seq'::regclass);


--
-- Name: saas_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plans ALTER COLUMN id SET DEFAULT nextval('public.saas_plans_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: setting_audit_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_audit_events ALTER COLUMN id SET DEFAULT nextval('public.setting_audit_events_id_seq'::regclass);


--
-- Name: setting_definitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_definitions ALTER COLUMN id SET DEFAULT nextval('public.setting_definitions_id_seq'::regclass);


--
-- Name: setting_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_values ALTER COLUMN id SET DEFAULT nextval('public.setting_values_id_seq'::regclass);


--
-- Name: setting_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_versions ALTER COLUMN id SET DEFAULT nextval('public.setting_versions_id_seq'::regclass);


--
-- Name: shift_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_schedules ALTER COLUMN id SET DEFAULT nextval('public.shift_schedules_id_seq'::regclass);


--
-- Name: skills_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills_registry ALTER COLUMN id SET DEFAULT nextval('public.skills_registry_id_seq'::regclass);


--
-- Name: studio_ad_contents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_ad_contents ALTER COLUMN id SET DEFAULT nextval('public.studio_ad_contents_id_seq'::regclass);


--
-- Name: studio_reels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_reels ALTER COLUMN id SET DEFAULT nextval('public.studio_reels_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: tax_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_settings ALTER COLUMN id SET DEFAULT nextval('public.tax_settings_id_seq'::regclass);


--
-- Name: tenant_branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_branches ALTER COLUMN id SET DEFAULT nextval('public.tenant_branches_id_seq'::regclass);


--
-- Name: tenant_departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments ALTER COLUMN id SET DEFAULT nextval('public.tenant_departments_id_seq'::regclass);


--
-- Name: tenant_job_titles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_job_titles ALTER COLUMN id SET DEFAULT nextval('public.tenant_job_titles_id_seq'::regclass);


--
-- Name: tenant_licenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_licenses ALTER COLUMN id SET DEFAULT nextval('public.tenant_licenses_id_seq'::regclass);


--
-- Name: tenant_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_locations ALTER COLUMN id SET DEFAULT nextval('public.tenant_locations_id_seq'::regclass);


--
-- Name: tenant_module_overrides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_overrides ALTER COLUMN id SET DEFAULT nextval('public.tenant_module_overrides_id_seq'::regclass);


--
-- Name: tenant_page_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_page_access ALTER COLUMN id SET DEFAULT nextval('public.tenant_page_access_id_seq'::regclass);


--
-- Name: tenant_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings ALTER COLUMN id SET DEFAULT nextval('public.tenant_settings_id_seq'::regclass);


--
-- Name: tenant_user_invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_invites ALTER COLUMN id SET DEFAULT nextval('public.tenant_user_invites_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: terms_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_rules ALTER COLUMN id SET DEFAULT nextval('public.terms_rules_id_seq'::regclass);


--
-- Name: terms_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_sections ALTER COLUMN id SET DEFAULT nextval('public.terms_sections_id_seq'::regclass);


--
-- Name: training_courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_courses ALTER COLUMN id SET DEFAULT nextval('public.training_courses_id_seq'::regclass);


--
-- Name: training_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_evaluations ALTER COLUMN id SET DEFAULT nextval('public.training_evaluations_id_seq'::regclass);


--
-- Name: training_programs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs ALTER COLUMN id SET DEFAULT nextval('public.training_programs_id_seq'::regclass);


--
-- Name: training_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions ALTER COLUMN id SET DEFAULT nextval('public.training_sessions_id_seq'::regclass);


--
-- Name: user_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials ALTER COLUMN id SET DEFAULT nextval('public.user_credentials_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wf_definitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_definitions ALTER COLUMN id SET DEFAULT nextval('public.wf_definitions_id_seq'::regclass);


--
-- Name: wf_instance_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_instance_events ALTER COLUMN id SET DEFAULT nextval('public.wf_instance_events_id_seq'::regclass);


--
-- Name: wf_instances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_instances ALTER COLUMN id SET DEFAULT nextval('public.wf_instances_id_seq'::regclass);


--
-- Name: restore_markers restore_markers_pkey; Type: CONSTRAINT; Schema: phase5_restore_sandbox; Owner: -
--

ALTER TABLE ONLY phase5_restore_sandbox.restore_markers
    ADD CONSTRAINT restore_markers_pkey PRIMARY KEY (id);


--
-- Name: accepted_employees accepted_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accepted_employees
    ADD CONSTRAINT accepted_employees_pkey PRIMARY KEY (id);


--
-- Name: account_type_sidebar_config account_type_sidebar_config_account_type_page_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_type_sidebar_config
    ADD CONSTRAINT account_type_sidebar_config_account_type_page_key_key UNIQUE (account_type, page_key);


--
-- Name: account_type_sidebar_config account_type_sidebar_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_type_sidebar_config
    ADD CONSTRAINT account_type_sidebar_config_pkey PRIMARY KEY (id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: amount_adjustments_logs amount_adjustments_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amount_adjustments_logs
    ADD CONSTRAINT amount_adjustments_logs_pkey PRIMARY KEY (id);


--
-- Name: amount_adjustments amount_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amount_adjustments
    ADD CONSTRAINT amount_adjustments_pkey PRIMARY KEY (id);


--
-- Name: approval_log approval_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_log
    ADD CONSTRAINT approval_log_pkey PRIMARY KEY (id);


--
-- Name: approval_steps approval_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: attendance_logs attendance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_jobs backup_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_jobs
    ADD CONSTRAINT backup_jobs_pkey PRIMARY KEY (id);


--
-- Name: backup_runs backup_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_runs
    ADD CONSTRAINT backup_runs_pkey PRIMARY KEY (id);


--
-- Name: beneficiaries beneficiaries_national_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_national_id_key UNIQUE (national_id);


--
-- Name: beneficiaries beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: branch_incubators branch_incubators_branch_id_incubator_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_incubators
    ADD CONSTRAINT branch_incubators_branch_id_incubator_id_key UNIQUE (branch_id, incubator_id);


--
-- Name: branch_incubators branch_incubators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_incubators
    ADD CONSTRAINT branch_incubators_pkey PRIMARY KEY (id);


--
-- Name: branch_platforms branch_platforms_branch_id_platform_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_platforms
    ADD CONSTRAINT branch_platforms_branch_id_platform_id_key UNIQUE (branch_id, platform_id);


--
-- Name: branch_platforms branch_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_platforms
    ADD CONSTRAINT branch_platforms_pkey PRIMARY KEY (id);


--
-- Name: branches branches_hq_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_hq_id_code_key UNIQUE (hq_id, code);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_certificate_number_key UNIQUE (certificate_number);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: community_marketing community_marketing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_marketing
    ADD CONSTRAINT community_marketing_pkey PRIMARY KEY (id);


--
-- Name: creator_page_follows creator_page_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_follows
    ADD CONSTRAINT creator_page_follows_pkey PRIMARY KEY (follower_user_id, page_id);


--
-- Name: creator_page_link_clicks creator_page_link_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_link_clicks
    ADD CONSTRAINT creator_page_link_clicks_pkey PRIMARY KEY (id);


--
-- Name: creator_page_links creator_page_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_links
    ADD CONSTRAINT creator_page_links_pkey PRIMARY KEY (id);


--
-- Name: creator_page_views creator_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_views
    ADD CONSTRAINT creator_page_views_pkey PRIMARY KEY (id);


--
-- Name: creator_pages creator_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_pkey PRIMARY KEY (id);


--
-- Name: creator_pages creator_pages_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_user_id_key UNIQUE (user_id);


--
-- Name: creator_pages creator_pages_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_username_key UNIQUE (username);


--
-- Name: daily_operations daily_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_operations
    ADD CONSTRAINT daily_operations_pkey PRIMARY KEY (id);


--
-- Name: development_programs development_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_programs
    ADD CONSTRAINT development_programs_pkey PRIMARY KEY (id);


--
-- Name: digital_marketing_campaigns digital_marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_marketing_campaigns
    ADD CONSTRAINT digital_marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: e_offices_records e_offices_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e_offices_records
    ADD CONSTRAINT e_offices_records_pkey PRIMARY KEY (id);


--
-- Name: employee_requests employee_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_requests
    ADD CONSTRAINT employee_requests_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_session_id_beneficiary_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_session_id_beneficiary_id_key UNIQUE (session_id, beneficiary_id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: evaluation_criteria evaluation_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_criteria
    ADD CONSTRAINT evaluation_criteria_pkey PRIMARY KEY (id);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: event_marketing event_marketing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_marketing
    ADD CONSTRAINT event_marketing_pkey PRIMARY KEY (id);


--
-- Name: events_studio_clips events_studio_clips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_clips
    ADD CONSTRAINT events_studio_clips_pkey PRIMARY KEY (id);


--
-- Name: events_studio_events events_studio_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_events
    ADD CONSTRAINT events_studio_events_pkey PRIMARY KEY (id);


--
-- Name: events_studio_publications events_studio_publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_publications
    ADD CONSTRAINT events_studio_publications_pkey PRIMARY KEY (id);


--
-- Name: events_studio_recordings events_studio_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_recordings
    ADD CONSTRAINT events_studio_recordings_pkey PRIMARY KEY (id);


--
-- Name: exchange_logs exchange_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_logs
    ADD CONSTRAINT exchange_logs_pkey PRIMARY KEY (id);


--
-- Name: exchange_requests exchange_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_requests
    ADD CONSTRAINT exchange_requests_pkey PRIMARY KEY (id);


--
-- Name: executive_goals executive_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_goals
    ADD CONSTRAINT executive_goals_pkey PRIMARY KEY (id);


--
-- Name: executive_kpis executive_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_kpis
    ADD CONSTRAINT executive_kpis_pkey PRIMARY KEY (id);


--
-- Name: executive_operations executive_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_operations
    ADD CONSTRAINT executive_operations_pkey PRIMARY KEY (id);


--
-- Name: facilities_contract_logs facilities_contract_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities_contract_logs
    ADD CONSTRAINT facilities_contract_logs_pkey PRIMARY KEY (id);


--
-- Name: facilities_project_contracts facilities_project_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities_project_contracts
    ADD CONSTRAINT facilities_project_contracts_pkey PRIMARY KEY (id);


--
-- Name: finance_accounts finance_accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_account_code_key UNIQUE (account_code);


--
-- Name: finance_accounts finance_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: finance_ai_forecasts finance_ai_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_ai_forecasts
    ADD CONSTRAINT finance_ai_forecasts_pkey PRIMARY KEY (forecast_id);


--
-- Name: finance_ai_risk_scores finance_ai_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_ai_risk_scores
    ADD CONSTRAINT finance_ai_risk_scores_pkey PRIMARY KEY (risk_id);


--
-- Name: finance_asset_depreciation finance_asset_depreciation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_asset_depreciation
    ADD CONSTRAINT finance_asset_depreciation_pkey PRIMARY KEY (depreciation_id);


--
-- Name: finance_budget_lines finance_budget_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_lines
    ADD CONSTRAINT finance_budget_lines_pkey PRIMARY KEY (line_id);


--
-- Name: finance_budget_variances finance_budget_variances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_variances
    ADD CONSTRAINT finance_budget_variances_pkey PRIMARY KEY (variance_id);


--
-- Name: finance_budgets finance_budgets_budget_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_budget_code_key UNIQUE (budget_code);


--
-- Name: finance_budgets finance_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_pkey PRIMARY KEY (budget_id);


--
-- Name: finance_cashflow_financing finance_cashflow_financing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow_financing
    ADD CONSTRAINT finance_cashflow_financing_pkey PRIMARY KEY (flow_id);


--
-- Name: finance_cashflow_investing finance_cashflow_investing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow_investing
    ADD CONSTRAINT finance_cashflow_investing_pkey PRIMARY KEY (flow_id);


--
-- Name: finance_cashflow_operating finance_cashflow_operating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow_operating
    ADD CONSTRAINT finance_cashflow_operating_pkey PRIMARY KEY (flow_id);


--
-- Name: finance_cashflow finance_cashflow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow
    ADD CONSTRAINT finance_cashflow_pkey PRIMARY KEY (cashflow_id);


--
-- Name: finance_customers finance_customers_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_customer_code_key UNIQUE (customer_code);


--
-- Name: finance_customers finance_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_pkey PRIMARY KEY (customer_id);


--
-- Name: finance_electronic_signatures finance_electronic_signatures_document_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_electronic_signatures
    ADD CONSTRAINT finance_electronic_signatures_document_key_key UNIQUE (document_key);


--
-- Name: finance_electronic_signatures finance_electronic_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_electronic_signatures
    ADD CONSTRAINT finance_electronic_signatures_pkey PRIMARY KEY (signature_id);


--
-- Name: finance_expenses finance_expenses_expense_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_expense_number_key UNIQUE (expense_number);


--
-- Name: finance_expenses finance_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_pkey PRIMARY KEY (expense_id);


--
-- Name: finance_fixed_assets finance_fixed_assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_asset_code_key UNIQUE (asset_code);


--
-- Name: finance_fixed_assets finance_fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_pkey PRIMARY KEY (asset_id);


--
-- Name: finance_invoice_lines finance_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoice_lines
    ADD CONSTRAINT finance_invoice_lines_pkey PRIMARY KEY (line_id);


--
-- Name: finance_invoices finance_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoices
    ADD CONSTRAINT finance_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: finance_invoices finance_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoices
    ADD CONSTRAINT finance_invoices_pkey PRIMARY KEY (invoice_id);


--
-- Name: finance_journal_entries finance_journal_entries_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_entries
    ADD CONSTRAINT finance_journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: finance_journal_entries finance_journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_entries
    ADD CONSTRAINT finance_journal_entries_pkey PRIMARY KEY (entry_id);


--
-- Name: finance_journal_lines finance_journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_pkey PRIMARY KEY (line_id);


--
-- Name: finance_payment_allocations finance_payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_allocations
    ADD CONSTRAINT finance_payment_allocations_pkey PRIMARY KEY (allocation_id);


--
-- Name: finance_payment_plans finance_payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_plans
    ADD CONSTRAINT finance_payment_plans_pkey PRIMARY KEY (plan_id);


--
-- Name: finance_payment_plans finance_payment_plans_plan_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_plans
    ADD CONSTRAINT finance_payment_plans_plan_number_key UNIQUE (plan_number);


--
-- Name: finance_payment_system_records finance_payment_system_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_system_records
    ADD CONSTRAINT finance_payment_system_records_pkey PRIMARY KEY (id);


--
-- Name: finance_payment_system_records finance_payment_system_records_record_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_system_records
    ADD CONSTRAINT finance_payment_system_records_record_number_key UNIQUE (record_number);


--
-- Name: finance_payments finance_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: finance_payments finance_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_pkey PRIMARY KEY (payment_id);


--
-- Name: finance_payroll_bank_batches finance_payroll_bank_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_bank_batches
    ADD CONSTRAINT finance_payroll_bank_batches_pkey PRIMARY KEY (batch_id);


--
-- Name: finance_payroll_components finance_payroll_components_component_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_components
    ADD CONSTRAINT finance_payroll_components_component_code_key UNIQUE (component_code);


--
-- Name: finance_payroll_components finance_payroll_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_components
    ADD CONSTRAINT finance_payroll_components_pkey PRIMARY KEY (component_id);


--
-- Name: finance_payroll_employee_components finance_payroll_employee_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_components
    ADD CONSTRAINT finance_payroll_employee_components_pkey PRIMARY KEY (employee_component_id);


--
-- Name: finance_payroll_employee_insurance finance_payroll_employee_insurance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_insurance
    ADD CONSTRAINT finance_payroll_employee_insurance_pkey PRIMARY KEY (employee_insurance_id);


--
-- Name: finance_payroll_employees finance_payroll_employees_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employees
    ADD CONSTRAINT finance_payroll_employees_employee_code_key UNIQUE (employee_code);


--
-- Name: finance_payroll_employees finance_payroll_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employees
    ADD CONSTRAINT finance_payroll_employees_pkey PRIMARY KEY (employee_id);


--
-- Name: finance_payroll_finance_deductions finance_payroll_finance_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_finance_deductions
    ADD CONSTRAINT finance_payroll_finance_deductions_pkey PRIMARY KEY (deduction_id);


--
-- Name: finance_payroll_finance_partners finance_payroll_finance_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_finance_partners
    ADD CONSTRAINT finance_payroll_finance_partners_pkey PRIMARY KEY (partner_id);


--
-- Name: finance_payroll_flexible_rules finance_payroll_flexible_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_flexible_rules
    ADD CONSTRAINT finance_payroll_flexible_rules_pkey PRIMARY KEY (rule_id);


--
-- Name: finance_payroll_insurance_profiles finance_payroll_insurance_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_insurance_profiles
    ADD CONSTRAINT finance_payroll_insurance_profiles_pkey PRIMARY KEY (profile_id);


--
-- Name: finance_payroll_item_lines finance_payroll_item_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_item_lines
    ADD CONSTRAINT finance_payroll_item_lines_pkey PRIMARY KEY (line_id);


--
-- Name: finance_payroll_items finance_payroll_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_items
    ADD CONSTRAINT finance_payroll_items_pkey PRIMARY KEY (item_id);


--
-- Name: finance_payroll_overtime finance_payroll_overtime_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_overtime
    ADD CONSTRAINT finance_payroll_overtime_pkey PRIMARY KEY (overtime_id);


--
-- Name: finance_payroll_runs finance_payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_runs
    ADD CONSTRAINT finance_payroll_runs_pkey PRIMARY KEY (run_id);


--
-- Name: finance_payroll_runs finance_payroll_runs_run_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_runs
    ADD CONSTRAINT finance_payroll_runs_run_number_key UNIQUE (run_number);


--
-- Name: finance_payroll_settlements finance_payroll_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_settlements
    ADD CONSTRAINT finance_payroll_settlements_pkey PRIMARY KEY (settlement_id);


--
-- Name: finance_payroll_wallet_transactions finance_payroll_wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_wallet_transactions
    ADD CONSTRAINT finance_payroll_wallet_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: finance_payroll_wallets finance_payroll_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_wallets
    ADD CONSTRAINT finance_payroll_wallets_pkey PRIMARY KEY (wallet_id);


--
-- Name: finance_plan_installments finance_plan_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_plan_installments
    ADD CONSTRAINT finance_plan_installments_pkey PRIMARY KEY (installment_id);


--
-- Name: finance_quick_offers finance_quick_offers_offer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_quick_offers
    ADD CONSTRAINT finance_quick_offers_offer_code_key UNIQUE (offer_code);


--
-- Name: finance_quick_offers finance_quick_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_quick_offers
    ADD CONSTRAINT finance_quick_offers_pkey PRIMARY KEY (id);


--
-- Name: finance_related_details finance_related_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_related_details
    ADD CONSTRAINT finance_related_details_pkey PRIMARY KEY (id);


--
-- Name: finance_return_requests finance_return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_return_requests
    ADD CONSTRAINT finance_return_requests_pkey PRIMARY KEY (id);


--
-- Name: finance_sales_settlements finance_sales_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_sales_settlements
    ADD CONSTRAINT finance_sales_settlements_pkey PRIMARY KEY (settlement_id);


--
-- Name: finance_sales_settlements finance_sales_settlements_settlement_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_sales_settlements
    ADD CONSTRAINT finance_sales_settlements_settlement_number_key UNIQUE (settlement_number);


--
-- Name: finance_shipping_fee_workflows finance_shipping_fee_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_shipping_fee_workflows
    ADD CONSTRAINT finance_shipping_fee_workflows_pkey PRIMARY KEY (id);


--
-- Name: finance_shipping_fees finance_shipping_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_shipping_fees
    ADD CONSTRAINT finance_shipping_fees_pkey PRIMARY KEY (fee_id);


--
-- Name: finance_signature_logs finance_signature_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_signature_logs
    ADD CONSTRAINT finance_signature_logs_pkey PRIMARY KEY (log_id);


--
-- Name: finance_vendors finance_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_vendors
    ADD CONSTRAINT finance_vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: finance_vendors finance_vendors_vendor_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_vendors
    ADD CONSTRAINT finance_vendors_vendor_code_key UNIQUE (vendor_code);


--
-- Name: financial_manual financial_manual_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_manual
    ADD CONSTRAINT financial_manual_pkey PRIMARY KEY (id);


--
-- Name: financial_news financial_news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_news
    ADD CONSTRAINT financial_news_pkey PRIMARY KEY (id);


--
-- Name: financial_operating_manual financial_operating_manual_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_operating_manual
    ADD CONSTRAINT financial_operating_manual_pkey PRIMARY KEY (id);


--
-- Name: financial_policies financial_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_policies
    ADD CONSTRAINT financial_policies_pkey PRIMARY KEY (id);


--
-- Name: financial_policies financial_policies_policy_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_policies
    ADD CONSTRAINT financial_policies_policy_code_key UNIQUE (policy_code);


--
-- Name: fiscal_periods fiscal_periods_fiscal_year_id_period_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_fiscal_year_id_period_no_key UNIQUE (fiscal_year_id, period_no);


--
-- Name: fiscal_periods fiscal_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_pkey PRIMARY KEY (id);


--
-- Name: fiscal_years fiscal_years_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_code_key UNIQUE (code);


--
-- Name: fiscal_years fiscal_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_pkey PRIMARY KEY (id);


--
-- Name: general_evaluations general_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_evaluations
    ADD CONSTRAINT general_evaluations_pkey PRIMARY KEY (id);


--
-- Name: governance_rules governance_rules_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_rules
    ADD CONSTRAINT governance_rules_name_key UNIQUE (name);


--
-- Name: governance_rules governance_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_rules
    ADD CONSTRAINT governance_rules_pkey PRIMARY KEY (id);


--
-- Name: headquarters headquarters_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.headquarters
    ADD CONSTRAINT headquarters_code_key UNIQUE (code);


--
-- Name: headquarters headquarters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.headquarters
    ADD CONSTRAINT headquarters_pkey PRIMARY KEY (id);


--
-- Name: hr_archive_activity_log hr_archive_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_archive_activity_log
    ADD CONSTRAINT hr_archive_activity_log_pkey PRIMARY KEY (id);


--
-- Name: hr_asset_classifications hr_asset_classifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_classifications
    ADD CONSTRAINT hr_asset_classifications_pkey PRIMARY KEY (id);


--
-- Name: hr_asset_classifications hr_asset_classifications_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_classifications
    ADD CONSTRAINT hr_asset_classifications_serial_number_key UNIQUE (serial_number);


--
-- Name: hr_asset_coding_system hr_asset_coding_system_code_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_coding_system
    ADD CONSTRAINT hr_asset_coding_system_code_prefix_key UNIQUE (code_prefix);


--
-- Name: hr_asset_coding_system hr_asset_coding_system_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_coding_system
    ADD CONSTRAINT hr_asset_coding_system_pkey PRIMARY KEY (id);


--
-- Name: hr_asset_registry hr_asset_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_registry
    ADD CONSTRAINT hr_asset_registry_pkey PRIMARY KEY (id);


--
-- Name: hr_asset_registry hr_asset_registry_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_registry
    ADD CONSTRAINT hr_asset_registry_serial_number_key UNIQUE (serial_number);


--
-- Name: hr_asset_type_summary hr_asset_type_summary_asset_type_ar_asset_type_en_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_type_summary
    ADD CONSTRAINT hr_asset_type_summary_asset_type_ar_asset_type_en_entity_id_key UNIQUE (asset_type_ar, asset_type_en, entity_id);


--
-- Name: hr_asset_type_summary hr_asset_type_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_type_summary
    ADD CONSTRAINT hr_asset_type_summary_pkey PRIMARY KEY (id);


--
-- Name: hr_asset_warehouse hr_asset_warehouse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_warehouse
    ADD CONSTRAINT hr_asset_warehouse_pkey PRIMARY KEY (id);


--
-- Name: hr_asset_warehouse hr_asset_warehouse_serial_number_ar_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_asset_warehouse
    ADD CONSTRAINT hr_asset_warehouse_serial_number_ar_key UNIQUE (serial_number_ar);


--
-- Name: hr_cost_optimization_departments hr_cost_optimization_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cost_optimization_departments
    ADD CONSTRAINT hr_cost_optimization_departments_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_profiles hr_employee_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profiles
    ADD CONSTRAINT hr_employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_records hr_employee_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_records
    ADD CONSTRAINT hr_employee_records_pkey PRIMARY KEY (id);


--
-- Name: hr_erp_integrations hr_erp_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_erp_integrations
    ADD CONSTRAINT hr_erp_integrations_pkey PRIMARY KEY (id);


--
-- Name: hr_experience_records hr_experience_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_experience_records
    ADD CONSTRAINT hr_experience_records_pkey PRIMARY KEY (id);


--
-- Name: hr_form_attachments hr_form_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_form_attachments
    ADD CONSTRAINT hr_form_attachments_pkey PRIMARY KEY (id);


--
-- Name: hr_human_risks hr_human_risks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_human_risks
    ADD CONSTRAINT hr_human_risks_pkey PRIMARY KEY (id);


--
-- Name: hr_innovation_ideas hr_innovation_ideas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_innovation_ideas
    ADD CONSTRAINT hr_innovation_ideas_pkey PRIMARY KEY (id);


--
-- Name: hr_learning_academy hr_learning_academy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_learning_academy
    ADD CONSTRAINT hr_learning_academy_pkey PRIMARY KEY (id);


--
-- Name: hr_module_record_files hr_module_record_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_module_record_files
    ADD CONSTRAINT hr_module_record_files_pkey PRIMARY KEY (id);


--
-- Name: hr_module_records hr_module_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_module_records
    ADD CONSTRAINT hr_module_records_pkey PRIMARY KEY (id);


--
-- Name: hr_ops_records hr_ops_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_ops_records
    ADD CONSTRAINT hr_ops_records_pkey PRIMARY KEY (id);


--
-- Name: hr_payroll_records hr_payroll_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_records
    ADD CONSTRAINT hr_payroll_records_pkey PRIMARY KEY (id);


--
-- Name: hr_performance_evaluations hr_performance_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_performance_evaluations
    ADD CONSTRAINT hr_performance_evaluations_pkey PRIMARY KEY (id);


--
-- Name: hr_productivity_records hr_productivity_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_productivity_records
    ADD CONSTRAINT hr_productivity_records_pkey PRIMARY KEY (id);


--
-- Name: hr_satisfaction_analytics hr_satisfaction_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_satisfaction_analytics
    ADD CONSTRAINT hr_satisfaction_analytics_pkey PRIMARY KEY (id);


--
-- Name: hr_skills_records hr_skills_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_skills_records
    ADD CONSTRAINT hr_skills_records_pkey PRIMARY KEY (id);


--
-- Name: hr_sso_integrations hr_sso_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_sso_integrations
    ADD CONSTRAINT hr_sso_integrations_pkey PRIMARY KEY (id);


--
-- Name: hr_strategic_monthly_indicators hr_strategic_monthly_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_strategic_monthly_indicators
    ADD CONSTRAINT hr_strategic_monthly_indicators_pkey PRIMARY KEY (id);


--
-- Name: hr_succession_plans hr_succession_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_succession_plans
    ADD CONSTRAINT hr_succession_plans_pkey PRIMARY KEY (id);


--
-- Name: hr_system_setting_records hr_system_setting_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_system_setting_records
    ADD CONSTRAINT hr_system_setting_records_pkey PRIMARY KEY (id);


--
-- Name: hr_talent_management hr_talent_management_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_talent_management
    ADD CONSTRAINT hr_talent_management_pkey PRIMARY KEY (id);


--
-- Name: hr_tasks hr_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tasks
    ADD CONSTRAINT hr_tasks_pkey PRIMARY KEY (id);


--
-- Name: hr_workforce_plans hr_workforce_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_workforce_plans
    ADD CONSTRAINT hr_workforce_plans_pkey PRIMARY KEY (id);


--
-- Name: incubators incubators_branch_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incubators
    ADD CONSTRAINT incubators_branch_id_code_key UNIQUE (branch_id, code);


--
-- Name: incubators incubators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incubators
    ADD CONSTRAINT incubators_pkey PRIMARY KEY (id);


--
-- Name: information_repository information_repository_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.information_repository
    ADD CONSTRAINT information_repository_pkey PRIMARY KEY (id);


--
-- Name: installment_plan_types installment_plan_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plan_types
    ADD CONSTRAINT installment_plan_types_pkey PRIMARY KEY (id);


--
-- Name: installment_plan_types installment_plan_types_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plan_types
    ADD CONSTRAINT installment_plan_types_plan_code_key UNIQUE (plan_code);


--
-- Name: integration_registry integration_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_registry
    ADD CONSTRAINT integration_registry_pkey PRIMARY KEY (id);


--
-- Name: integration_registry integration_registry_tenant_id_integration_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_registry
    ADD CONSTRAINT integration_registry_tenant_id_integration_key_key UNIQUE (tenant_id, integration_key);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: kpi_evaluations kpi_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_evaluations
    ADD CONSTRAINT kpi_evaluations_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: module_numbering_counters module_numbering_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_numbering_counters
    ADD CONSTRAINT module_numbering_counters_pkey PRIMARY KEY (id);


--
-- Name: module_numbering_counters module_numbering_counters_series_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_numbering_counters
    ADD CONSTRAINT module_numbering_counters_series_key_key UNIQUE (series_key);


--
-- Name: module_template_versions module_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_template_versions
    ADD CONSTRAINT module_template_versions_pkey PRIMARY KEY (id);


--
-- Name: module_template_versions module_template_versions_template_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_template_versions
    ADD CONSTRAINT module_template_versions_template_id_version_key UNIQUE (template_id, version);


--
-- Name: module_templates module_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_templates
    ADD CONSTRAINT module_templates_pkey PRIMARY KEY (id);


--
-- Name: module_templates module_templates_template_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_templates
    ADD CONSTRAINT module_templates_template_type_code_key UNIQUE (template_type, code);


--
-- Name: new_hires new_hires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.new_hires
    ADD CONSTRAINT new_hires_pkey PRIMARY KEY (id);


--
-- Name: nocode_records nocode_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nocode_records
    ADD CONSTRAINT nocode_records_pkey PRIMARY KEY (id);


--
-- Name: nocode_systems nocode_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nocode_systems
    ADD CONSTRAINT nocode_systems_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: office_platforms office_platforms_office_id_platform_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_platforms
    ADD CONSTRAINT office_platforms_office_id_platform_id_key UNIQUE (office_id, platform_id);


--
-- Name: office_platforms office_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_platforms
    ADD CONSTRAINT office_platforms_pkey PRIMARY KEY (id);


--
-- Name: offices offices_incubator_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_incubator_id_code_key UNIQUE (incubator_id, code);


--
-- Name: offices offices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_pkey PRIMARY KEY (id);


--
-- Name: operational_monitoring operational_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_monitoring
    ADD CONSTRAINT operational_monitoring_pkey PRIMARY KEY (id);


--
-- Name: operational_policies operational_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_policies
    ADD CONSTRAINT operational_policies_pkey PRIMARY KEY (id);


--
-- Name: operational_policies operational_policies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_policies
    ADD CONSTRAINT operational_policies_slug_key UNIQUE (slug);


--
-- Name: operational_policy_updates operational_policy_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_policy_updates
    ADD CONSTRAINT operational_policy_updates_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_method_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_method_code_key UNIQUE (method_code);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: platform_api_error_events platform_api_error_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_api_error_events
    ADD CONSTRAINT platform_api_error_events_pkey PRIMARY KEY (id);


--
-- Name: platform_feature_flags platform_feature_flags_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_feature_flags
    ADD CONSTRAINT platform_feature_flags_key_key UNIQUE (key);


--
-- Name: platform_feature_flags platform_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_feature_flags
    ADD CONSTRAINT platform_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: platform_owner_audit platform_owner_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_owner_audit
    ADD CONSTRAINT platform_owner_audit_pkey PRIMARY KEY (id);


--
-- Name: platforms platforms_incubator_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platforms
    ADD CONSTRAINT platforms_incubator_id_code_key UNIQUE (incubator_id, code);


--
-- Name: platforms platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platforms
    ADD CONSTRAINT platforms_pkey PRIMARY KEY (id);


--
-- Name: quality_audits quality_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_pkey PRIMARY KEY (id);


--
-- Name: quality_standards quality_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_standards
    ADD CONSTRAINT quality_standards_pkey PRIMARY KEY (id);


--
-- Name: quality_standards quality_standards_standard_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_standards
    ADD CONSTRAINT quality_standards_standard_code_key UNIQUE (standard_code);


--
-- Name: records_master_register records_master_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records_master_register
    ADD CONSTRAINT records_master_register_pkey PRIMARY KEY (id);


--
-- Name: records_students_affairs records_students_affairs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records_students_affairs
    ADD CONSTRAINT records_students_affairs_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: saas_plan_modules saas_plan_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plan_modules
    ADD CONSTRAINT saas_plan_modules_pkey PRIMARY KEY (id);


--
-- Name: saas_plan_modules saas_plan_modules_plan_code_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plan_modules
    ADD CONSTRAINT saas_plan_modules_plan_code_module_key_key UNIQUE (plan_code, module_key);


--
-- Name: saas_plans saas_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plans
    ADD CONSTRAINT saas_plans_code_key UNIQUE (code);


--
-- Name: saas_plans saas_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plans
    ADD CONSTRAINT saas_plans_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: setting_audit_events setting_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_audit_events
    ADD CONSTRAINT setting_audit_events_pkey PRIMARY KEY (id);


--
-- Name: setting_definitions setting_definitions_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_definitions
    ADD CONSTRAINT setting_definitions_key_key UNIQUE (key);


--
-- Name: setting_definitions setting_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_definitions
    ADD CONSTRAINT setting_definitions_pkey PRIMARY KEY (id);


--
-- Name: setting_values setting_values_definition_key_tenant_id_branch_id_module_ke_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_values
    ADD CONSTRAINT setting_values_definition_key_tenant_id_branch_id_module_ke_key UNIQUE (definition_key, tenant_id, branch_id, module_key);


--
-- Name: setting_values setting_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_values
    ADD CONSTRAINT setting_values_pkey PRIMARY KEY (id);


--
-- Name: setting_versions setting_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_versions
    ADD CONSTRAINT setting_versions_pkey PRIMARY KEY (id);


--
-- Name: setting_versions setting_versions_setting_value_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_versions
    ADD CONSTRAINT setting_versions_setting_value_id_version_key UNIQUE (setting_value_id, version);


--
-- Name: shift_schedules shift_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_schedules
    ADD CONSTRAINT shift_schedules_pkey PRIMARY KEY (id);


--
-- Name: skills_registry skills_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills_registry
    ADD CONSTRAINT skills_registry_pkey PRIMARY KEY (id);


--
-- Name: studio_ad_contents studio_ad_contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_ad_contents
    ADD CONSTRAINT studio_ad_contents_pkey PRIMARY KEY (id);


--
-- Name: studio_reels studio_reels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_reels
    ADD CONSTRAINT studio_reels_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tax_settings tax_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_pkey PRIMARY KEY (id);


--
-- Name: tax_settings tax_settings_tax_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_tax_code_key UNIQUE (tax_code);


--
-- Name: tenant_branches tenant_branches_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_branches
    ADD CONSTRAINT tenant_branches_code_key UNIQUE (code);


--
-- Name: tenant_branches tenant_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_branches
    ADD CONSTRAINT tenant_branches_pkey PRIMARY KEY (id);


--
-- Name: tenant_departments tenant_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_pkey PRIMARY KEY (id);


--
-- Name: tenant_job_titles tenant_job_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_job_titles
    ADD CONSTRAINT tenant_job_titles_pkey PRIMARY KEY (id);


--
-- Name: tenant_licenses tenant_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_licenses
    ADD CONSTRAINT tenant_licenses_pkey PRIMARY KEY (id);


--
-- Name: tenant_licenses tenant_licenses_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_licenses
    ADD CONSTRAINT tenant_licenses_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenant_locations tenant_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_locations
    ADD CONSTRAINT tenant_locations_pkey PRIMARY KEY (id);


--
-- Name: tenant_module_overrides tenant_module_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_overrides
    ADD CONSTRAINT tenant_module_overrides_pkey PRIMARY KEY (id);


--
-- Name: tenant_module_overrides tenant_module_overrides_tenant_id_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_overrides
    ADD CONSTRAINT tenant_module_overrides_tenant_id_module_key_key UNIQUE (tenant_id, module_key);


--
-- Name: tenant_page_access tenant_page_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_page_access
    ADD CONSTRAINT tenant_page_access_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_key_key UNIQUE (key);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: tenant_user_invites tenant_user_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_invites
    ADD CONSTRAINT tenant_user_invites_pkey PRIMARY KEY (id);


--
-- Name: tenant_user_invites tenant_user_invites_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_invites
    ADD CONSTRAINT tenant_user_invites_token_hash_key UNIQUE (token_hash);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subdomain_key UNIQUE (subdomain);


--
-- Name: terms_rules terms_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_rules
    ADD CONSTRAINT terms_rules_pkey PRIMARY KEY (id);


--
-- Name: terms_sections terms_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_sections
    ADD CONSTRAINT terms_sections_pkey PRIMARY KEY (id);


--
-- Name: training_courses training_courses_course_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_courses
    ADD CONSTRAINT training_courses_course_code_key UNIQUE (course_code);


--
-- Name: training_courses training_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_courses
    ADD CONSTRAINT training_courses_pkey PRIMARY KEY (id);


--
-- Name: training_evaluations training_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_evaluations
    ADD CONSTRAINT training_evaluations_pkey PRIMARY KEY (id);


--
-- Name: training_programs training_programs_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_code_key UNIQUE (code);


--
-- Name: training_programs training_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_pkey PRIMARY KEY (id);


--
-- Name: training_sessions training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_pkey PRIMARY KEY (id);


--
-- Name: training_sessions training_sessions_session_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_session_code_key UNIQUE (session_code);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_credentials user_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_pkey PRIMARY KEY (id);


--
-- Name: user_credentials user_credentials_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_user_id_key UNIQUE (user_id);


--
-- Name: user_credentials user_credentials_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_username_key UNIQUE (username);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_entity_id_key UNIQUE (user_id, role_id, entity_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wf_definitions wf_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_definitions
    ADD CONSTRAINT wf_definitions_pkey PRIMARY KEY (id);


--
-- Name: wf_definitions wf_definitions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_definitions
    ADD CONSTRAINT wf_definitions_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: wf_instance_events wf_instance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_instance_events
    ADD CONSTRAINT wf_instance_events_pkey PRIMARY KEY (id);


--
-- Name: wf_instances wf_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_instances
    ADD CONSTRAINT wf_instances_pkey PRIMARY KEY (id);


--
-- Name: idx_accepted_employees_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accepted_employees_entity ON public.accepted_employees USING btree (entity_id);


--
-- Name: idx_accepted_employees_hire_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accepted_employees_hire_date ON public.accepted_employees USING btree (hire_date);


--
-- Name: idx_ai_forecasts_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_forecasts_entity ON public.finance_ai_forecasts USING btree (entity_id);


--
-- Name: idx_ai_forecasts_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_forecasts_period ON public.finance_ai_forecasts USING btree (forecast_period);


--
-- Name: idx_ai_forecasts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_forecasts_type ON public.finance_ai_forecasts USING btree (forecast_type);


--
-- Name: idx_ai_risks_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_risks_customer ON public.finance_ai_risk_scores USING btree (customer_id);


--
-- Name: idx_amount_adjustments_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amount_adjustments_approval ON public.amount_adjustments USING btree (approval_status);


--
-- Name: idx_amount_adjustments_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amount_adjustments_branch ON public.amount_adjustments USING btree (branch_name);


--
-- Name: idx_amount_adjustments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amount_adjustments_date ON public.amount_adjustments USING btree (request_date);


--
-- Name: idx_amount_adjustments_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amount_adjustments_logs_action ON public.amount_adjustments_logs USING btree (action);


--
-- Name: idx_amount_adjustments_logs_adjustment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amount_adjustments_logs_adjustment ON public.amount_adjustments_logs USING btree (adjustment_id);


--
-- Name: idx_amount_adjustments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amount_adjustments_status ON public.amount_adjustments USING btree (status);


--
-- Name: idx_approval_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_log_status ON public.approval_log USING btree (status);


--
-- Name: idx_asset_depreciation_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_depreciation_date ON public.finance_asset_depreciation USING btree (depreciation_date);


--
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_category ON public.finance_fixed_assets USING btree (asset_category);


--
-- Name: idx_assets_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_code ON public.finance_fixed_assets USING btree (asset_code);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.finance_fixed_assets USING btree (status);


--
-- Name: idx_attendance_logs_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_logs_customer ON public.attendance_logs USING btree (customer_number);


--
-- Name: idx_attendance_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_logs_date ON public.attendance_logs USING btree (attendance_date);


--
-- Name: idx_attendance_logs_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_logs_employee ON public.attendance_logs USING btree (employee_id);


--
-- Name: idx_attendance_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_logs_entity ON public.attendance_logs USING btree (entity_id);


--
-- Name: idx_attendance_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_logs_status ON public.attendance_logs USING btree (status);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_backup_runs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_runs_job ON public.backup_runs USING btree (job_id);


--
-- Name: idx_backup_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_runs_status ON public.backup_runs USING btree (status);


--
-- Name: idx_beneficiaries_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beneficiaries_entity ON public.beneficiaries USING btree (entity_id);


--
-- Name: idx_branch_incubators_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_incubators_branch ON public.branch_incubators USING btree (branch_id);


--
-- Name: idx_branch_incubators_incubator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_incubators_incubator ON public.branch_incubators USING btree (incubator_id);


--
-- Name: idx_branch_platforms_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_platforms_branch ON public.branch_platforms USING btree (branch_id);


--
-- Name: idx_branch_platforms_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_platforms_platform ON public.branch_platforms USING btree (platform_id);


--
-- Name: idx_branches_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_entity_id ON public.branches USING btree (entity_id);


--
-- Name: idx_branches_hq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_hq ON public.branches USING btree (hq_id);


--
-- Name: idx_budget_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_lines_account ON public.finance_budget_lines USING btree (account_id);


--
-- Name: idx_budgets_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_entity ON public.finance_budgets USING btree (entity_type, entity_id);


--
-- Name: idx_budgets_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_year ON public.finance_budgets USING btree (fiscal_year);


--
-- Name: idx_cashflow_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_date ON public.finance_cashflow USING btree (transaction_date);


--
-- Name: idx_cashflow_financing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_financing_date ON public.finance_cashflow_financing USING btree (flow_date);


--
-- Name: idx_cashflow_financing_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_financing_entity ON public.finance_cashflow_financing USING btree (entity_id);


--
-- Name: idx_cashflow_investing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_investing_date ON public.finance_cashflow_investing USING btree (flow_date);


--
-- Name: idx_cashflow_investing_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_investing_entity ON public.finance_cashflow_investing USING btree (entity_id);


--
-- Name: idx_cashflow_operating_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_operating_date ON public.finance_cashflow_operating USING btree (flow_date);


--
-- Name: idx_cashflow_operating_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_operating_entity ON public.finance_cashflow_operating USING btree (entity_id);


--
-- Name: idx_cashflow_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashflow_type ON public.finance_cashflow USING btree (flow_type);


--
-- Name: idx_creator_pages_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_pages_enabled ON public.creator_pages USING btree (is_enabled, is_deleted);


--
-- Name: idx_creator_pages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_pages_user_id ON public.creator_pages USING btree (user_id);


--
-- Name: idx_creator_pages_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_pages_username ON public.creator_pages USING btree (username);


--
-- Name: idx_credentials_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_user_id ON public.user_credentials USING btree (user_id);


--
-- Name: idx_credentials_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_username ON public.user_credentials USING btree (username);


--
-- Name: idx_daily_operations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_operations_date ON public.daily_operations USING btree (operation_date);


--
-- Name: idx_dept_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_branch ON public.tenant_departments USING btree (branch_id);


--
-- Name: idx_dept_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_parent ON public.tenant_departments USING btree (parent_id);


--
-- Name: idx_digital_marketing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_digital_marketing_status ON public.digital_marketing_campaigns USING btree (status);


--
-- Name: idx_e_offices_records_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_e_offices_records_module ON public.e_offices_records USING btree (module_key, entity_id);


--
-- Name: idx_employee_requests_current_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_requests_current_stage ON public.employee_requests USING btree (current_stage);


--
-- Name: idx_employee_requests_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_requests_entity ON public.employee_requests USING btree (entity_id);


--
-- Name: idx_employee_requests_status_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_requests_status_stage ON public.employee_requests USING btree (status, current_stage);


--
-- Name: idx_entities_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_type ON public.entities USING btree (type);


--
-- Name: idx_evaluations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_date ON public.evaluations USING btree (evaluation_date);


--
-- Name: idx_evaluations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_status ON public.evaluations USING btree (status);


--
-- Name: idx_evaluations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_type ON public.evaluations USING btree (evaluation_type);


--
-- Name: idx_events_studio_clips_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_studio_clips_entity ON public.events_studio_clips USING btree (entity_id);


--
-- Name: idx_events_studio_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_studio_events_entity ON public.events_studio_events USING btree (entity_id);


--
-- Name: idx_events_studio_publications_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_studio_publications_entity ON public.events_studio_publications USING btree (entity_id);


--
-- Name: idx_events_studio_recordings_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_studio_recordings_entity ON public.events_studio_recordings USING btree (entity_id);


--
-- Name: idx_exchange_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_logs_action ON public.exchange_logs USING btree (action);


--
-- Name: idx_exchange_logs_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_logs_request ON public.exchange_logs USING btree (request_id);


--
-- Name: idx_exchange_requests_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_requests_approval ON public.exchange_requests USING btree (approval_status);


--
-- Name: idx_exchange_requests_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_requests_branch ON public.exchange_requests USING btree (branch_name);


--
-- Name: idx_exchange_requests_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_requests_date ON public.exchange_requests USING btree (request_date);


--
-- Name: idx_executive_goals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_executive_goals_status ON public.executive_goals USING btree (status);


--
-- Name: idx_executive_kpis_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_executive_kpis_period ON public.executive_kpis USING btree (period);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category ON public.finance_expenses USING btree (expense_category);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.finance_expenses USING btree (expense_date);


--
-- Name: idx_expenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_status ON public.finance_expenses USING btree (status);


--
-- Name: idx_fac_contract_logs_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fac_contract_logs_contract ON public.facilities_contract_logs USING btree (contract_id);


--
-- Name: idx_fac_contract_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fac_contract_logs_entity ON public.facilities_contract_logs USING btree (entity_id);


--
-- Name: idx_fin_related_details_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_related_details_created ON public.finance_related_details USING btree (created_at);


--
-- Name: idx_fin_related_details_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_related_details_record ON public.finance_related_details USING btree (page_key, record_id);


--
-- Name: idx_fin_sales_settlements_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sales_settlements_channel ON public.finance_sales_settlements USING btree (channel);


--
-- Name: idx_fin_sales_settlements_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sales_settlements_entity ON public.finance_sales_settlements USING btree (entity_type, entity_id);


--
-- Name: idx_fin_sales_settlements_last_update; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sales_settlements_last_update ON public.finance_sales_settlements USING btree (last_update);


--
-- Name: idx_fin_sales_settlements_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sales_settlements_owner ON public.finance_sales_settlements USING btree (owner_name);


--
-- Name: idx_fin_sales_settlements_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sales_settlements_status ON public.finance_sales_settlements USING btree (status);


--
-- Name: idx_fin_sign_doc_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sign_doc_key ON public.finance_electronic_signatures USING btree (document_key);


--
-- Name: idx_fin_sign_logs_doc_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_sign_logs_doc_key ON public.finance_signature_logs USING btree (document_key);


--
-- Name: idx_finance_accounts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_accounts_code ON public.finance_accounts USING btree (account_code);


--
-- Name: idx_finance_accounts_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_accounts_entity ON public.finance_accounts USING btree (entity_type, entity_id);


--
-- Name: idx_finance_accounts_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_accounts_parent ON public.finance_accounts USING btree (parent_account_id);


--
-- Name: idx_finance_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_accounts_type ON public.finance_accounts USING btree (account_type);


--
-- Name: idx_financial_manual_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_manual_category ON public.financial_manual USING btree (category);


--
-- Name: idx_financial_manual_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_manual_section ON public.financial_manual USING btree (section_order);


--
-- Name: idx_financial_policies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_policies_status ON public.financial_policies USING btree (status);


--
-- Name: idx_fiscal_periods_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_periods_dates ON public.fiscal_periods USING btree (start_date, end_date);


--
-- Name: idx_fiscal_periods_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_periods_year ON public.fiscal_periods USING btree (fiscal_year_id);


--
-- Name: idx_fiscal_years_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_years_current ON public.fiscal_years USING btree (is_current);


--
-- Name: idx_headquarters_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_headquarters_entity_id ON public.headquarters USING btree (entity_id);


--
-- Name: idx_hr_archive_activity_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_archive_activity_created ON public.hr_archive_activity_log USING btree (created_at DESC);


--
-- Name: idx_hr_archive_activity_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_archive_activity_entity ON public.hr_archive_activity_log USING btree (entity_id);


--
-- Name: idx_hr_archive_activity_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_archive_activity_record ON public.hr_archive_activity_log USING btree (record_id);


--
-- Name: idx_hr_asset_classifications_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_asset_classifications_entity ON public.hr_asset_classifications USING btree (entity_id);


--
-- Name: idx_hr_asset_coding_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_asset_coding_entity ON public.hr_asset_coding_system USING btree (entity_id);


--
-- Name: idx_hr_asset_registry_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_asset_registry_entity ON public.hr_asset_registry USING btree (entity_id);


--
-- Name: idx_hr_asset_type_summary_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_asset_type_summary_entity ON public.hr_asset_type_summary USING btree (entity_id);


--
-- Name: idx_hr_asset_warehouse_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_asset_warehouse_entity ON public.hr_asset_warehouse USING btree (entity_id);


--
-- Name: idx_hr_cost_dept_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_cost_dept_name ON public.hr_cost_optimization_departments USING btree (department_name);


--
-- Name: idx_hr_cost_efficiency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_cost_efficiency ON public.hr_cost_optimization_departments USING btree (efficiency_percent);


--
-- Name: idx_hr_cost_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_cost_entity ON public.hr_cost_optimization_departments USING btree (entity_id);


--
-- Name: idx_hr_emp_profiles_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_profiles_entity ON public.hr_employee_profiles USING btree (entity_id);


--
-- Name: idx_hr_emp_records_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_records_employee ON public.hr_employee_records USING btree (employee_id);


--
-- Name: idx_hr_emp_records_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_records_entity ON public.hr_employee_records USING btree (entity_id);


--
-- Name: idx_hr_emp_records_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_records_period ON public.hr_employee_records USING btree (period);


--
-- Name: idx_hr_emp_records_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_records_section ON public.hr_employee_records USING btree (section);


--
-- Name: idx_hr_emp_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_records_status ON public.hr_employee_records USING btree (status);


--
-- Name: idx_hr_erp_integrations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_erp_integrations_entity ON public.hr_erp_integrations USING btree (entity_id);


--
-- Name: idx_hr_erp_integrations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_erp_integrations_status ON public.hr_erp_integrations USING btree (status);


--
-- Name: idx_hr_experience_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_experience_entity ON public.hr_experience_records USING btree (entity_id);


--
-- Name: idx_hr_experience_field; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_experience_field ON public.hr_experience_records USING btree (experience_field);


--
-- Name: idx_hr_experience_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_experience_status ON public.hr_experience_records USING btree (status);


--
-- Name: idx_hr_experience_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_experience_type ON public.hr_experience_records USING btree (experience_type);


--
-- Name: idx_hr_form_att_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_form_att_entity ON public.hr_form_attachments USING btree (entity_id);


--
-- Name: idx_hr_form_att_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_form_att_page ON public.hr_form_attachments USING btree (page_path);


--
-- Name: idx_hr_human_risks_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_human_risks_entity ON public.hr_human_risks USING btree (entity_id);


--
-- Name: idx_hr_human_risks_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_human_risks_level ON public.hr_human_risks USING btree (risk_level);


--
-- Name: idx_hr_human_risks_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_human_risks_review ON public.hr_human_risks USING btree (review_date);


--
-- Name: idx_hr_human_risks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_human_risks_status ON public.hr_human_risks USING btree (follow_status);


--
-- Name: idx_hr_innovation_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_innovation_department ON public.hr_innovation_ideas USING btree (department);


--
-- Name: idx_hr_innovation_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_innovation_entity ON public.hr_innovation_ideas USING btree (entity_id);


--
-- Name: idx_hr_innovation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_innovation_status ON public.hr_innovation_ideas USING btree (status);


--
-- Name: idx_hr_innovation_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_innovation_type ON public.hr_innovation_ideas USING btree (innovation_type);


--
-- Name: idx_hr_learning_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_learning_entity ON public.hr_learning_academy USING btree (entity_id);


--
-- Name: idx_hr_learning_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_learning_status ON public.hr_learning_academy USING btree (status);


--
-- Name: idx_hr_module_record_files_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_record_files_entity ON public.hr_module_record_files USING btree (entity_id);


--
-- Name: idx_hr_module_record_files_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_record_files_module ON public.hr_module_record_files USING btree (module_key);


--
-- Name: idx_hr_module_record_files_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_record_files_record ON public.hr_module_record_files USING btree (record_id);


--
-- Name: idx_hr_module_records_archive_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_archive_date ON public.hr_module_records USING btree (archive_date);


--
-- Name: idx_hr_module_records_confidentiality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_confidentiality ON public.hr_module_records USING btree (confidentiality);


--
-- Name: idx_hr_module_records_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_display_order ON public.hr_module_records USING btree (display_order);


--
-- Name: idx_hr_module_records_doc_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_doc_category ON public.hr_module_records USING btree (doc_category);


--
-- Name: idx_hr_module_records_doc_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_doc_number ON public.hr_module_records USING btree (doc_number);


--
-- Name: idx_hr_module_records_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_entity ON public.hr_module_records USING btree (entity_id);


--
-- Name: idx_hr_module_records_keywords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_keywords ON public.hr_module_records USING btree (keywords);


--
-- Name: idx_hr_module_records_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_module ON public.hr_module_records USING btree (module_key);


--
-- Name: idx_hr_module_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_module_records_status ON public.hr_module_records USING btree (status);


--
-- Name: idx_hr_ops_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_ops_module ON public.hr_ops_records USING btree (module_key, entity_id);


--
-- Name: idx_hr_payroll_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_date ON public.hr_payroll_records USING btree (pay_date);


--
-- Name: idx_hr_payroll_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_department ON public.hr_payroll_records USING btree (department);


--
-- Name: idx_hr_payroll_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_entity ON public.hr_payroll_records USING btree (entity_id);


--
-- Name: idx_hr_payroll_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_month ON public.hr_payroll_records USING btree (payroll_month);


--
-- Name: idx_hr_payroll_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_status ON public.hr_payroll_records USING btree (status);


--
-- Name: idx_hr_perf_eval_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_perf_eval_date ON public.hr_performance_evaluations USING btree (evaluation_date);


--
-- Name: idx_hr_perf_eval_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_perf_eval_department ON public.hr_performance_evaluations USING btree (department);


--
-- Name: idx_hr_perf_eval_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_perf_eval_entity ON public.hr_performance_evaluations USING btree (entity_id);


--
-- Name: idx_hr_perf_eval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_perf_eval_status ON public.hr_performance_evaluations USING btree (status);


--
-- Name: idx_hr_prod_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_prod_department ON public.hr_productivity_records USING btree (department);


--
-- Name: idx_hr_prod_efficiency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_prod_efficiency ON public.hr_productivity_records USING btree (efficiency_percent);


--
-- Name: idx_hr_prod_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_prod_employee_id ON public.hr_productivity_records USING btree (employee_id);


--
-- Name: idx_hr_prod_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_prod_entity ON public.hr_productivity_records USING btree (entity_id);


--
-- Name: idx_hr_satisfaction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_satisfaction_date ON public.hr_satisfaction_analytics USING btree (evaluation_date);


--
-- Name: idx_hr_satisfaction_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_satisfaction_department ON public.hr_satisfaction_analytics USING btree (department_name);


--
-- Name: idx_hr_satisfaction_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_satisfaction_employee ON public.hr_satisfaction_analytics USING btree (employee_name);


--
-- Name: idx_hr_satisfaction_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_satisfaction_entity ON public.hr_satisfaction_analytics USING btree (entity_id);


--
-- Name: idx_hr_satisfaction_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_satisfaction_level ON public.hr_satisfaction_analytics USING btree (satisfaction_level);


--
-- Name: idx_hr_skills_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_skills_date ON public.hr_skills_records USING btree (assessment_date);


--
-- Name: idx_hr_skills_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_skills_department ON public.hr_skills_records USING btree (department);


--
-- Name: idx_hr_skills_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_skills_entity ON public.hr_skills_records USING btree (entity_id);


--
-- Name: idx_hr_skills_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_skills_level ON public.hr_skills_records USING btree (skill_level);


--
-- Name: idx_hr_skills_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_skills_status ON public.hr_skills_records USING btree (skill_status);


--
-- Name: idx_hr_sso_integrations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_sso_integrations_entity ON public.hr_sso_integrations USING btree (entity_id);


--
-- Name: idx_hr_sso_integrations_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_sso_integrations_protocol ON public.hr_sso_integrations USING btree (protocol);


--
-- Name: idx_hr_strategic_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_strategic_entity ON public.hr_strategic_monthly_indicators USING btree (entity_id);


--
-- Name: idx_hr_strategic_month_entity_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_hr_strategic_month_entity_key ON public.hr_strategic_monthly_indicators USING btree (entity_id, month_key);


--
-- Name: idx_hr_strategic_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_strategic_period ON public.hr_strategic_monthly_indicators USING btree (period);


--
-- Name: idx_hr_succession_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_succession_entity ON public.hr_succession_plans USING btree (entity_id);


--
-- Name: idx_hr_succession_readiness; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_succession_readiness ON public.hr_succession_plans USING btree (readiness_level);


--
-- Name: idx_hr_succession_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_succession_review ON public.hr_succession_plans USING btree (review_date);


--
-- Name: idx_hr_succession_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_succession_role ON public.hr_succession_plans USING btree (role_title);


--
-- Name: idx_hr_succession_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_succession_status ON public.hr_succession_plans USING btree (succession_status);


--
-- Name: idx_hr_sysset_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_sysset_catalog ON public.hr_system_setting_records USING btree (catalog_key);


--
-- Name: idx_hr_sysset_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_sysset_entity ON public.hr_system_setting_records USING btree (entity_id);


--
-- Name: idx_hr_sysset_unique_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_hr_sysset_unique_code ON public.hr_system_setting_records USING btree (entity_id, catalog_key, code) WHERE ((code IS NOT NULL) AND (code <> ''::text));


--
-- Name: idx_hr_talent_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_talent_classification ON public.hr_talent_management USING btree (talent_classification);


--
-- Name: idx_hr_talent_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_talent_entity ON public.hr_talent_management USING btree (entity_id);


--
-- Name: idx_hr_talent_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_talent_performance ON public.hr_talent_management USING btree (performance_level);


--
-- Name: idx_hr_talent_potential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_talent_potential ON public.hr_talent_management USING btree (potential_level);


--
-- Name: idx_hr_talent_review_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_talent_review_date ON public.hr_talent_management USING btree (last_review_date);


--
-- Name: idx_hr_tasks_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tasks_end_date ON public.hr_tasks USING btree (end_date);


--
-- Name: idx_hr_tasks_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tasks_entity ON public.hr_tasks USING btree (entity_id);


--
-- Name: idx_hr_tasks_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tasks_priority ON public.hr_tasks USING btree (priority);


--
-- Name: idx_hr_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tasks_status ON public.hr_tasks USING btree (status);


--
-- Name: idx_hr_workforce_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_workforce_department ON public.hr_workforce_plans USING btree (department_name);


--
-- Name: idx_hr_workforce_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_workforce_entity ON public.hr_workforce_plans USING btree (entity_id);


--
-- Name: idx_hr_workforce_review_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_workforce_review_date ON public.hr_workforce_plans USING btree (review_date);


--
-- Name: idx_hr_workforce_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_workforce_status ON public.hr_workforce_plans USING btree (status);


--
-- Name: idx_incubators_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incubators_branch ON public.incubators USING btree (branch_id);


--
-- Name: idx_incubators_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incubators_entity_id ON public.incubators USING btree (entity_id);


--
-- Name: idx_information_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_information_category ON public.information_repository USING btree (category);


--
-- Name: idx_installment_plan_types_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installment_plan_types_active ON public.installment_plan_types USING btree (is_active);


--
-- Name: idx_integ_reg_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integ_reg_enabled ON public.integration_registry USING btree (is_enabled);


--
-- Name: idx_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_email ON public.tenant_user_invites USING btree (email);


--
-- Name: idx_invites_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_status ON public.tenant_user_invites USING btree (status);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer ON public.finance_invoices USING btree (customer_id);


--
-- Name: idx_invoices_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_date ON public.finance_invoices USING btree (invoice_date);


--
-- Name: idx_invoices_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_entity ON public.finance_invoices USING btree (entity_type, entity_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.finance_invoices USING btree (status);


--
-- Name: idx_job_titles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_titles_active ON public.tenant_job_titles USING btree (is_active);


--
-- Name: idx_journal_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_date ON public.finance_journal_entries USING btree (entry_date);


--
-- Name: idx_journal_entries_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_entity ON public.finance_journal_entries USING btree (entity_type, entity_id);


--
-- Name: idx_journal_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_status ON public.finance_journal_entries USING btree (status);


--
-- Name: idx_journal_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_account ON public.finance_journal_lines USING btree (account_id);


--
-- Name: idx_journal_lines_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_entry ON public.finance_journal_lines USING btree (entry_id);


--
-- Name: idx_leave_balances_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_employee ON public.leave_balances USING btree (employee_name);


--
-- Name: idx_leave_balances_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_entity ON public.leave_balances USING btree (entity_id);


--
-- Name: idx_leave_balances_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_year ON public.leave_balances USING btree (year);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (employee_name);


--
-- Name: idx_leave_requests_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_entity ON public.leave_requests USING btree (entity_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_locations_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_branch ON public.tenant_locations USING btree (branch_id);


--
-- Name: idx_master_register_confidentiality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_register_confidentiality ON public.records_master_register USING btree (confidentiality);


--
-- Name: idx_master_register_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_register_date ON public.records_master_register USING btree (doc_date);


--
-- Name: idx_master_register_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_register_entity ON public.records_master_register USING btree (entity_id);


--
-- Name: idx_master_register_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_register_status ON public.records_master_register USING btree (status);


--
-- Name: idx_module_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_module_templates_type ON public.module_templates USING btree (template_type);


--
-- Name: idx_new_hires_decision_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_new_hires_decision_at ON public.new_hires USING btree (decision_at);


--
-- Name: idx_new_hires_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_new_hires_entity ON public.new_hires USING btree (entity_id);


--
-- Name: idx_new_hires_interview_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_new_hires_interview_date ON public.new_hires USING btree (interview_date);


--
-- Name: idx_new_hires_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_new_hires_status ON public.new_hires USING btree (status);


--
-- Name: idx_nocode_records_system_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nocode_records_system_table ON public.nocode_records USING btree (system_id, table_key);


--
-- Name: idx_notif_outbox_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_outbox_status ON public.notification_outbox USING btree (status, next_attempt_at);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_office_platforms_office; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_platforms_office ON public.office_platforms USING btree (office_id);


--
-- Name: idx_office_platforms_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_platforms_platform ON public.office_platforms USING btree (platform_id);


--
-- Name: idx_offices_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offices_entity_id ON public.offices USING btree (entity_id);


--
-- Name: idx_offices_incubator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offices_incubator ON public.offices USING btree (incubator_id);


--
-- Name: idx_operational_policies_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_policies_slug ON public.operational_policies USING btree (slug);


--
-- Name: idx_operational_policy_updates_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_policy_updates_policy ON public.operational_policy_updates USING btree (policy_id);


--
-- Name: idx_payment_allocations_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_allocations_invoice ON public.finance_payment_allocations USING btree (invoice_id);


--
-- Name: idx_payment_methods_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (is_active);


--
-- Name: idx_payment_plans_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_plans_customer ON public.finance_payment_plans USING btree (customer_id);


--
-- Name: idx_payment_system_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_system_date ON public.finance_payment_system_records USING btree (record_date);


--
-- Name: idx_payment_system_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_system_entity ON public.finance_payment_system_records USING btree (entity_id);


--
-- Name: idx_payment_system_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_system_module ON public.finance_payment_system_records USING btree (module_type);


--
-- Name: idx_payment_system_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_system_status ON public.finance_payment_system_records USING btree (status);


--
-- Name: idx_payments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_customer ON public.finance_payments USING btree (customer_id);


--
-- Name: idx_payments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_date ON public.finance_payments USING btree (payment_date);


--
-- Name: idx_payroll_components_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_components_entity ON public.finance_payroll_components USING btree (entity_type, entity_id);


--
-- Name: idx_payroll_employee_components_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_employee_components_employee ON public.finance_payroll_employee_components USING btree (employee_id);


--
-- Name: idx_payroll_employees_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_employees_active ON public.finance_payroll_employees USING btree (is_active);


--
-- Name: idx_payroll_employees_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_employees_entity ON public.finance_payroll_employees USING btree (entity_type, entity_id);


--
-- Name: idx_payroll_item_lines_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_item_lines_item ON public.finance_payroll_item_lines USING btree (item_id);


--
-- Name: idx_payroll_items_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_items_employee ON public.finance_payroll_items USING btree (employee_id);


--
-- Name: idx_payroll_items_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_items_run ON public.finance_payroll_items USING btree (run_id);


--
-- Name: idx_payroll_overtime_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_overtime_employee ON public.finance_payroll_overtime USING btree (employee_id);


--
-- Name: idx_payroll_overtime_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_overtime_status ON public.finance_payroll_overtime USING btree (status);


--
-- Name: idx_payroll_runs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_runs_entity ON public.finance_payroll_runs USING btree (entity_type, entity_id);


--
-- Name: idx_payroll_runs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_runs_period ON public.finance_payroll_runs USING btree (period_year, period_month);


--
-- Name: idx_payroll_settlements_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_settlements_employee ON public.finance_payroll_settlements USING btree (employee_id);


--
-- Name: idx_payroll_settlements_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_settlements_run ON public.finance_payroll_settlements USING btree (payroll_run_id);


--
-- Name: idx_payroll_settlements_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_settlements_status ON public.finance_payroll_settlements USING btree (status);


--
-- Name: idx_payroll_wallet_tx_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_wallet_tx_wallet ON public.finance_payroll_wallet_transactions USING btree (wallet_id);


--
-- Name: idx_platform_api_errors_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_api_errors_created ON public.platform_api_error_events USING btree (created_at DESC);


--
-- Name: idx_platform_owner_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_owner_audit_created ON public.platform_owner_audit USING btree (created_at DESC);


--
-- Name: idx_platform_owner_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_owner_audit_tenant ON public.platform_owner_audit USING btree (tenant_id);


--
-- Name: idx_platforms_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platforms_entity_id ON public.platforms USING btree (entity_id);


--
-- Name: idx_platforms_incubator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platforms_incubator ON public.platforms USING btree (incubator_id);


--
-- Name: idx_quality_audits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_audits_status ON public.quality_audits USING btree (status);


--
-- Name: idx_quick_offers_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quick_offers_dates ON public.finance_quick_offers USING btree (start_at, end_at);


--
-- Name: idx_quick_offers_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quick_offers_entity ON public.finance_quick_offers USING btree (entity_id);


--
-- Name: idx_quick_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quick_offers_status ON public.finance_quick_offers USING btree (status);


--
-- Name: idx_return_requests_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_received ON public.finance_return_requests USING btree (received);


--
-- Name: idx_return_requests_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_risk ON public.finance_return_requests USING btree (risk);


--
-- Name: idx_return_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_status ON public.finance_return_requests USING btree (status);


--
-- Name: idx_saas_plan_modules_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saas_plan_modules_plan ON public.saas_plan_modules USING btree (plan_code);


--
-- Name: idx_saas_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saas_plans_active ON public.saas_plans USING btree (is_active);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.user_sessions USING btree (session_token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_setting_audit_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_audit_key ON public.setting_audit_events USING btree (definition_key);


--
-- Name: idx_setting_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_audit_tenant ON public.setting_audit_events USING btree (tenant_id);


--
-- Name: idx_setting_definitions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_definitions_module ON public.setting_definitions USING btree (module_key);


--
-- Name: idx_setting_definitions_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_definitions_scope ON public.setting_definitions USING btree (scope);


--
-- Name: idx_setting_values_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_values_key ON public.setting_values USING btree (definition_key);


--
-- Name: idx_setting_values_scope_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_setting_values_scope_unique ON public.setting_values USING btree (definition_key, COALESCE(tenant_id, 0), COALESCE(branch_id, 0), COALESCE(module_key, ''::character varying));


--
-- Name: idx_setting_values_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_values_tenant ON public.setting_values USING btree (tenant_id);


--
-- Name: idx_setting_versions_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_versions_value ON public.setting_versions USING btree (setting_value_id);


--
-- Name: idx_shift_schedules_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_schedules_customer ON public.shift_schedules USING btree (customer_number);


--
-- Name: idx_shift_schedules_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_schedules_employee ON public.shift_schedules USING btree (employee_id);


--
-- Name: idx_shift_schedules_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_schedules_entity ON public.shift_schedules USING btree (entity_id);


--
-- Name: idx_shift_schedules_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_schedules_name ON public.shift_schedules USING btree (employee_name);


--
-- Name: idx_shift_schedules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_schedules_status ON public.shift_schedules USING btree (status);


--
-- Name: idx_shipping_fees_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_fees_carrier ON public.finance_shipping_fees USING btree (carrier);


--
-- Name: idx_shipping_fees_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_fees_entity ON public.finance_shipping_fees USING btree (entity_id);


--
-- Name: idx_shipping_fees_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_fees_risk ON public.finance_shipping_fees USING btree (risk_level);


--
-- Name: idx_shipping_fees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_fees_status ON public.finance_shipping_fees USING btree (status);


--
-- Name: idx_shipping_fees_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_fees_zone ON public.finance_shipping_fees USING btree (zone);


--
-- Name: idx_shipping_workflow_fee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_workflow_fee ON public.finance_shipping_fee_workflows USING btree (fee_id);


--
-- Name: idx_students_affairs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_affairs_date ON public.records_students_affairs USING btree (registration_date);


--
-- Name: idx_students_affairs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_affairs_entity ON public.records_students_affairs USING btree (entity_id);


--
-- Name: idx_students_affairs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_affairs_status ON public.records_students_affairs USING btree (status);


--
-- Name: idx_students_affairs_student_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_affairs_student_number ON public.records_students_affairs USING btree (student_number);


--
-- Name: idx_tax_settings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_settings_active ON public.tax_settings USING btree (is_active);


--
-- Name: idx_tenant_licenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_licenses_status ON public.tenant_licenses USING btree (status);


--
-- Name: idx_tenant_module_overrides_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_module_overrides_tenant ON public.tenant_module_overrides USING btree (tenant_id);


--
-- Name: idx_terms_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terms_rules_active ON public.terms_rules USING btree (is_active);


--
-- Name: idx_terms_rules_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terms_rules_order ON public.terms_rules USING btree (display_order);


--
-- Name: idx_terms_rules_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terms_rules_section ON public.terms_rules USING btree (section_id);


--
-- Name: idx_terms_sections_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terms_sections_active ON public.terms_sections USING btree (is_active);


--
-- Name: idx_terms_sections_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terms_sections_order ON public.terms_sections USING btree (display_order);


--
-- Name: idx_training_courses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_courses_status ON public.training_courses USING btree (status);


--
-- Name: idx_training_programs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_programs_entity ON public.training_programs USING btree (entity_id);


--
-- Name: idx_training_sessions_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_sessions_entity ON public.training_sessions USING btree (entity_id);


--
-- Name: idx_user_roles_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_entity ON public.user_roles USING btree (entity_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_users_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_entity_id ON public.users USING btree (entity_id);


--
-- Name: idx_vendors_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_code ON public.finance_vendors USING btree (vendor_code);


--
-- Name: idx_wf_def_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_def_active ON public.wf_definitions USING btree (is_active);


--
-- Name: idx_wf_def_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_def_module ON public.wf_definitions USING btree (module_key);


--
-- Name: idx_wf_events_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_events_instance ON public.wf_instance_events USING btree (instance_id);


--
-- Name: idx_wf_inst_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_inst_entity ON public.wf_instances USING btree (entity_type, entity_id);


--
-- Name: idx_wf_inst_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_inst_status ON public.wf_instances USING btree (status);


--
-- Name: idx_wf_inst_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_inst_tenant ON public.wf_instances USING btree (tenant_id);


--
-- Name: tenant_page_access_entity_page_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_page_access_entity_page_key_idx ON public.tenant_page_access USING btree (tenant_entity_id, page_key);


--
-- Name: tenant_page_access_tenant_page_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_page_access_tenant_page_key_idx ON public.tenant_page_access USING btree (tenant_id, page_key);


--
-- Name: uq_accepted_employees_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_accepted_employees_identity ON public.accepted_employees USING btree (full_name, job_title, hire_date, entity_id);


--
-- Name: uq_hr_employee_profiles_entity_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_hr_employee_profiles_entity_employee ON public.hr_employee_profiles USING btree (entity_id, employee_id);


--
-- Name: uq_hr_prod_entity_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_hr_prod_entity_employee_id ON public.hr_productivity_records USING btree (entity_id, employee_id) WHERE ((employee_id IS NOT NULL) AND (employee_id <> ''::text));


--
-- Name: uq_leave_balances_employee_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_leave_balances_employee_year ON public.leave_balances USING btree (entity_id, employee_name, year);


--
-- Name: uq_new_hires_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_new_hires_reference ON public.new_hires USING btree (reference_code, entity_id);


--
-- Name: branches update_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: headquarters update_headquarters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_headquarters_updated_at BEFORE UPDATE ON public.headquarters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: incubators update_incubators_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_incubators_updated_at BEFORE UPDATE ON public.incubators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: offices update_offices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON public.offices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: platforms update_platforms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON public.platforms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: terms_rules update_terms_rules_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_terms_rules_timestamp BEFORE UPDATE ON public.terms_rules FOR EACH ROW EXECUTE FUNCTION public.update_terms_rules_updated_at();


--
-- Name: terms_sections update_terms_sections_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_terms_sections_timestamp BEFORE UPDATE ON public.terms_sections FOR EACH ROW EXECUTE FUNCTION public.update_terms_sections_updated_at();


--
-- Name: ads ads_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: ads ads_source_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_source_entity_id_fkey FOREIGN KEY (source_entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: amount_adjustments_logs amount_adjustments_logs_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amount_adjustments_logs
    ADD CONSTRAINT amount_adjustments_logs_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.amount_adjustments(id) ON DELETE CASCADE;


--
-- Name: approval_log approval_log_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_log
    ADD CONSTRAINT approval_log_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: approval_log approval_log_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_log
    ADD CONSTRAINT approval_log_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: approval_steps approval_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id) ON DELETE CASCADE;


--
-- Name: assessments assessments_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: backup_runs backup_runs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_runs
    ADD CONSTRAINT backup_runs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.backup_jobs(id) ON DELETE SET NULL;


--
-- Name: beneficiaries beneficiaries_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: branch_incubators branch_incubators_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_incubators
    ADD CONSTRAINT branch_incubators_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: branch_incubators branch_incubators_incubator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_incubators
    ADD CONSTRAINT branch_incubators_incubator_id_fkey FOREIGN KEY (incubator_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: branch_platforms branch_platforms_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_platforms
    ADD CONSTRAINT branch_platforms_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: branch_platforms branch_platforms_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_platforms
    ADD CONSTRAINT branch_platforms_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: branches branches_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: branches branches_hq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_hq_id_fkey FOREIGN KEY (hq_id) REFERENCES public.headquarters(id) ON DELETE CASCADE;


--
-- Name: certificates certificates_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE;


--
-- Name: certificates certificates_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;


--
-- Name: certificates certificates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.training_programs(id) ON DELETE CASCADE;


--
-- Name: creator_page_follows creator_page_follows_follower_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_follows
    ADD CONSTRAINT creator_page_follows_follower_user_id_fkey FOREIGN KEY (follower_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: creator_page_follows creator_page_follows_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_follows
    ADD CONSTRAINT creator_page_follows_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.creator_pages(id) ON DELETE CASCADE;


--
-- Name: creator_page_link_clicks creator_page_link_clicks_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_link_clicks
    ADD CONSTRAINT creator_page_link_clicks_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.creator_pages(id) ON DELETE CASCADE;


--
-- Name: creator_page_link_clicks creator_page_link_clicks_viewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_link_clicks
    ADD CONSTRAINT creator_page_link_clicks_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: creator_page_links creator_page_links_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_links
    ADD CONSTRAINT creator_page_links_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.creator_pages(id) ON DELETE CASCADE;


--
-- Name: creator_page_views creator_page_views_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_views
    ADD CONSTRAINT creator_page_views_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.creator_pages(id) ON DELETE CASCADE;


--
-- Name: creator_page_views creator_page_views_viewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_page_views
    ADD CONSTRAINT creator_page_views_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: creator_pages creator_pages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_operations daily_operations_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_operations
    ADD CONSTRAINT daily_operations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: daily_operations daily_operations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_operations
    ADD CONSTRAINT daily_operations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: daily_operations daily_operations_incubator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_operations
    ADD CONSTRAINT daily_operations_incubator_id_fkey FOREIGN KEY (incubator_id) REFERENCES public.incubators(id);


--
-- Name: daily_operations daily_operations_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_operations
    ADD CONSTRAINT daily_operations_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms(id);


--
-- Name: employee_requests employee_requests_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_requests
    ADD CONSTRAINT employee_requests_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: enrollments enrollments_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;


--
-- Name: entities entities_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: entities entities_hq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_hq_id_fkey FOREIGN KEY (hq_id) REFERENCES public.headquarters(id);


--
-- Name: entities entities_incubator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_incubator_id_fkey FOREIGN KEY (incubator_id) REFERENCES public.incubators(id);


--
-- Name: entities entities_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id);


--
-- Name: entities entities_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms(id);


--
-- Name: events_studio_clips events_studio_clips_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_clips
    ADD CONSTRAINT events_studio_clips_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.events_studio_recordings(id) ON DELETE CASCADE;


--
-- Name: events_studio_publications events_studio_publications_clip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_publications
    ADD CONSTRAINT events_studio_publications_clip_id_fkey FOREIGN KEY (clip_id) REFERENCES public.events_studio_clips(id) ON DELETE SET NULL;


--
-- Name: events_studio_recordings events_studio_recordings_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_studio_recordings
    ADD CONSTRAINT events_studio_recordings_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events_studio_events(id) ON DELETE SET NULL;


--
-- Name: exchange_logs exchange_logs_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_logs
    ADD CONSTRAINT exchange_logs_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.exchange_requests(id) ON DELETE CASCADE;


--
-- Name: executive_goals executive_goals_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_goals
    ADD CONSTRAINT executive_goals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: executive_operations executive_operations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_operations
    ADD CONSTRAINT executive_operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: facilities_contract_logs facilities_contract_logs_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities_contract_logs
    ADD CONSTRAINT facilities_contract_logs_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.facilities_project_contracts(id) ON DELETE CASCADE;


--
-- Name: finance_accounts finance_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_ai_risk_scores finance_ai_risk_scores_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_ai_risk_scores
    ADD CONSTRAINT finance_ai_risk_scores_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.finance_customers(customer_id);


--
-- Name: finance_asset_depreciation finance_asset_depreciation_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_asset_depreciation
    ADD CONSTRAINT finance_asset_depreciation_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.finance_fixed_assets(asset_id);


--
-- Name: finance_asset_depreciation finance_asset_depreciation_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_asset_depreciation
    ADD CONSTRAINT finance_asset_depreciation_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(entry_id);


--
-- Name: finance_budget_lines finance_budget_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_lines
    ADD CONSTRAINT finance_budget_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_budget_lines finance_budget_lines_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_lines
    ADD CONSTRAINT finance_budget_lines_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.finance_budgets(budget_id) ON DELETE CASCADE;


--
-- Name: finance_budget_variances finance_budget_variances_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budget_variances
    ADD CONSTRAINT finance_budget_variances_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_cashflow finance_cashflow_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cashflow
    ADD CONSTRAINT finance_cashflow_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(entry_id);


--
-- Name: finance_expenses finance_expenses_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(entry_id);


--
-- Name: finance_expenses finance_expenses_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.finance_vendors(vendor_id);


--
-- Name: finance_fixed_assets finance_fixed_assets_accumulated_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_accumulated_depreciation_account_id_fkey FOREIGN KEY (accumulated_depreciation_account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_fixed_assets finance_fixed_assets_asset_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_asset_account_id_fkey FOREIGN KEY (asset_account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_fixed_assets finance_fixed_assets_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_depreciation_account_id_fkey FOREIGN KEY (depreciation_account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_invoice_lines finance_invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoice_lines
    ADD CONSTRAINT finance_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(invoice_id) ON DELETE CASCADE;


--
-- Name: finance_invoice_lines finance_invoice_lines_revenue_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoice_lines
    ADD CONSTRAINT finance_invoice_lines_revenue_account_id_fkey FOREIGN KEY (revenue_account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_invoices finance_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoices
    ADD CONSTRAINT finance_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.finance_customers(customer_id);


--
-- Name: finance_invoices finance_invoices_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoices
    ADD CONSTRAINT finance_invoices_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(entry_id);


--
-- Name: finance_journal_lines finance_journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(account_id);


--
-- Name: finance_journal_lines finance_journal_lines_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.finance_journal_entries(entry_id) ON DELETE CASCADE;


--
-- Name: finance_payment_allocations finance_payment_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_allocations
    ADD CONSTRAINT finance_payment_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(invoice_id);


--
-- Name: finance_payment_allocations finance_payment_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_allocations
    ADD CONSTRAINT finance_payment_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.finance_payments(payment_id) ON DELETE CASCADE;


--
-- Name: finance_payment_plans finance_payment_plans_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_plans
    ADD CONSTRAINT finance_payment_plans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.finance_customers(customer_id);


--
-- Name: finance_payment_plans finance_payment_plans_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payment_plans
    ADD CONSTRAINT finance_payment_plans_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(invoice_id);


--
-- Name: finance_payments finance_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.finance_customers(customer_id);


--
-- Name: finance_payments finance_payments_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(entry_id);


--
-- Name: finance_payroll_bank_batches finance_payroll_bank_batches_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_bank_batches
    ADD CONSTRAINT finance_payroll_bank_batches_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.finance_payroll_runs(run_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_employee_components finance_payroll_employee_components_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_components
    ADD CONSTRAINT finance_payroll_employee_components_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.finance_payroll_components(component_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_employee_components finance_payroll_employee_components_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_components
    ADD CONSTRAINT finance_payroll_employee_components_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_employee_insurance finance_payroll_employee_insurance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_insurance
    ADD CONSTRAINT finance_payroll_employee_insurance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_employee_insurance finance_payroll_employee_insurance_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_employee_insurance
    ADD CONSTRAINT finance_payroll_employee_insurance_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.finance_payroll_insurance_profiles(profile_id);


--
-- Name: finance_payroll_finance_deductions finance_payroll_finance_deductions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_finance_deductions
    ADD CONSTRAINT finance_payroll_finance_deductions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_finance_deductions finance_payroll_finance_deductions_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_finance_deductions
    ADD CONSTRAINT finance_payroll_finance_deductions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.finance_payroll_finance_partners(partner_id);


--
-- Name: finance_payroll_item_lines finance_payroll_item_lines_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_item_lines
    ADD CONSTRAINT finance_payroll_item_lines_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.finance_payroll_components(component_id);


--
-- Name: finance_payroll_item_lines finance_payroll_item_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_item_lines
    ADD CONSTRAINT finance_payroll_item_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.finance_payroll_items(item_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_items finance_payroll_items_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_items
    ADD CONSTRAINT finance_payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_items finance_payroll_items_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_items
    ADD CONSTRAINT finance_payroll_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.finance_payroll_runs(run_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_overtime finance_payroll_overtime_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_overtime
    ADD CONSTRAINT finance_payroll_overtime_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_overtime finance_payroll_overtime_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_overtime
    ADD CONSTRAINT finance_payroll_overtime_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.finance_payroll_runs(run_id);


--
-- Name: finance_payroll_runs finance_payroll_runs_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_runs
    ADD CONSTRAINT finance_payroll_runs_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(entry_id);


--
-- Name: finance_payroll_settlements finance_payroll_settlements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_settlements
    ADD CONSTRAINT finance_payroll_settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_settlements finance_payroll_settlements_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_settlements
    ADD CONSTRAINT finance_payroll_settlements_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.finance_payroll_runs(run_id);


--
-- Name: finance_payroll_wallet_transactions finance_payroll_wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_wallet_transactions
    ADD CONSTRAINT finance_payroll_wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.finance_payroll_wallets(wallet_id) ON DELETE CASCADE;


--
-- Name: finance_payroll_wallets finance_payroll_wallets_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payroll_wallets
    ADD CONSTRAINT finance_payroll_wallets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.finance_payroll_employees(employee_id) ON DELETE CASCADE;


--
-- Name: finance_plan_installments finance_plan_installments_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_plan_installments
    ADD CONSTRAINT finance_plan_installments_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.finance_payments(payment_id);


--
-- Name: finance_plan_installments finance_plan_installments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_plan_installments
    ADD CONSTRAINT finance_plan_installments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.finance_payment_plans(plan_id) ON DELETE CASCADE;


--
-- Name: finance_shipping_fee_workflows finance_shipping_fee_workflows_fee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_shipping_fee_workflows
    ADD CONSTRAINT finance_shipping_fee_workflows_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES public.finance_shipping_fees(fee_id) ON DELETE CASCADE;


--
-- Name: finance_signature_logs finance_signature_logs_signature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_signature_logs
    ADD CONSTRAINT finance_signature_logs_signature_id_fkey FOREIGN KEY (signature_id) REFERENCES public.finance_electronic_signatures(signature_id) ON DELETE CASCADE;


--
-- Name: financial_news financial_news_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_news
    ADD CONSTRAINT financial_news_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id);


--
-- Name: financial_operating_manual financial_operating_manual_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_operating_manual
    ADD CONSTRAINT financial_operating_manual_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: financial_policies financial_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_policies
    ADD CONSTRAINT financial_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: fiscal_periods fiscal_periods_fiscal_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_fiscal_year_id_fkey FOREIGN KEY (fiscal_year_id) REFERENCES public.fiscal_years(id) ON DELETE CASCADE;


--
-- Name: general_evaluations general_evaluations_evaluator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_evaluations
    ADD CONSTRAINT general_evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.users(id);


--
-- Name: headquarters headquarters_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.headquarters
    ADD CONSTRAINT headquarters_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: hr_archive_activity_log hr_archive_activity_log_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_archive_activity_log
    ADD CONSTRAINT hr_archive_activity_log_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.hr_module_records(id) ON DELETE CASCADE;


--
-- Name: hr_module_record_files hr_module_record_files_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_module_record_files
    ADD CONSTRAINT hr_module_record_files_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.hr_module_records(id) ON DELETE CASCADE;


--
-- Name: incubators incubators_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incubators
    ADD CONSTRAINT incubators_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: incubators incubators_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incubators
    ADD CONSTRAINT incubators_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: information_repository information_repository_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.information_repository
    ADD CONSTRAINT information_repository_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: knowledge_base knowledge_base_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: kpi_evaluations kpi_evaluations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_evaluations
    ADD CONSTRAINT kpi_evaluations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: kpi_evaluations kpi_evaluations_evaluated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_evaluations
    ADD CONSTRAINT kpi_evaluations_evaluated_by_fkey FOREIGN KEY (evaluated_by) REFERENCES public.users(id);


--
-- Name: ledger ledger_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: ledger ledger_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: nocode_records nocode_records_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nocode_records
    ADD CONSTRAINT nocode_records_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.nocode_systems(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: office_platforms office_platforms_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_platforms
    ADD CONSTRAINT office_platforms_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE CASCADE;


--
-- Name: office_platforms office_platforms_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_platforms
    ADD CONSTRAINT office_platforms_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms(id) ON DELETE CASCADE;


--
-- Name: offices offices_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: offices offices_incubator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_incubator_id_fkey FOREIGN KEY (incubator_id) REFERENCES public.incubators(id) ON DELETE CASCADE;


--
-- Name: operational_policy_updates operational_policy_updates_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_policy_updates
    ADD CONSTRAINT operational_policy_updates_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.operational_policies(id) ON DELETE CASCADE;


--
-- Name: platforms platforms_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platforms
    ADD CONSTRAINT platforms_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: platforms platforms_incubator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platforms
    ADD CONSTRAINT platforms_incubator_id_fkey FOREIGN KEY (incubator_id) REFERENCES public.incubators(id) ON DELETE CASCADE;


--
-- Name: quality_audits quality_audits_auditor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_auditor_id_fkey FOREIGN KEY (auditor_id) REFERENCES public.users(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: saas_plan_modules saas_plan_modules_plan_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plan_modules
    ADD CONSTRAINT saas_plan_modules_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES public.saas_plans(code) ON DELETE CASCADE;


--
-- Name: setting_values setting_values_definition_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_values
    ADD CONSTRAINT setting_values_definition_key_fkey FOREIGN KEY (definition_key) REFERENCES public.setting_definitions(key) ON DELETE CASCADE;


--
-- Name: setting_versions setting_versions_setting_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_versions
    ADD CONSTRAINT setting_versions_setting_value_id_fkey FOREIGN KEY (setting_value_id) REFERENCES public.setting_values(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_departments tenant_departments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE SET NULL;


--
-- Name: tenant_departments tenant_departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.tenant_departments(id) ON DELETE SET NULL;


--
-- Name: tenant_job_titles tenant_job_titles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_job_titles
    ADD CONSTRAINT tenant_job_titles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.tenant_departments(id) ON DELETE SET NULL;


--
-- Name: tenant_licenses tenant_licenses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_licenses
    ADD CONSTRAINT tenant_licenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_locations tenant_locations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_locations
    ADD CONSTRAINT tenant_locations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE SET NULL;


--
-- Name: tenant_module_overrides tenant_module_overrides_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_overrides
    ADD CONSTRAINT tenant_module_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_page_access tenant_page_access_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_page_access
    ADD CONSTRAINT tenant_page_access_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_user_invites tenant_user_invites_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_invites
    ADD CONSTRAINT tenant_user_invites_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE SET NULL;


--
-- Name: terms_rules terms_rules_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_rules
    ADD CONSTRAINT terms_rules_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.terms_sections(id) ON DELETE CASCADE;


--
-- Name: training_evaluations training_evaluations_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_evaluations
    ADD CONSTRAINT training_evaluations_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.users(id);


--
-- Name: training_evaluations training_evaluations_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_evaluations
    ADD CONSTRAINT training_evaluations_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.development_programs(id);


--
-- Name: training_programs training_programs_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.training_programs(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: user_credentials user_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;


--
-- Name: wf_instance_events wf_instance_events_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_instance_events
    ADD CONSTRAINT wf_instance_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.wf_instances(id) ON DELETE CASCADE;


--
-- Name: wf_instances wf_instances_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_instances
    ADD CONSTRAINT wf_instances_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.wf_definitions(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 786jeLlOafDmgpMuzNrssYhr8Ken9JtmPKrd3MzOf5AU21QqxZcgQefKmIAI6DO



-- TABLE STATS

-- accepted_employees: ~0 rows
-- account_type_sidebar_config: ~0 rows
-- ads: ~3 rows
-- amount_adjustments: ~3 rows
-- amount_adjustments_logs: ~0 rows
-- approval_log: ~0 rows
-- approval_steps: ~2 rows
-- approval_workflows: ~1 rows
-- assessments: ~0 rows
-- attendance_logs: ~0 rows
-- audit_logs: ~0 rows
-- backup_jobs: ~1 rows
-- backup_runs: ~4 rows
-- beneficiaries: ~0 rows
-- branch_incubators: ~4 rows
-- branch_platforms: ~4 rows
-- branches: ~29 rows
-- certificates: ~0 rows
-- community_marketing: ~5 rows
-- creator_page_follows: ~0 rows
-- creator_page_link_clicks: ~0 rows
-- creator_page_links: ~0 rows
-- creator_page_views: ~0 rows
-- creator_pages: ~0 rows
-- daily_operations: ~7 rows
-- development_programs: ~5 rows
-- digital_marketing_campaigns: ~5 rows
-- e_offices_records: ~0 rows
-- employee_requests: ~3 rows
-- enrollments: ~0 rows
-- entities: ~6855 rows
-- evaluation_criteria: ~6 rows
-- evaluations: ~5 rows
-- event_marketing: ~5 rows
-- events_studio_clips: ~0 rows
-- events_studio_events: ~0 rows
-- events_studio_publications: ~0 rows
-- events_studio_recordings: ~0 rows
-- exchange_logs: ~0 rows
-- exchange_requests: ~4 rows
-- executive_goals: ~8 rows
-- executive_kpis: ~6 rows
-- executive_operations: ~5 rows
-- facilities_contract_logs: ~0 rows
-- facilities_project_contracts: ~0 rows
-- finance_accounts: ~61 rows
-- finance_ai_forecasts: ~6 rows
-- finance_ai_risk_scores: ~0 rows
-- finance_asset_depreciation: ~0 rows
-- finance_budget_lines: ~0 rows
-- finance_budget_variances: ~0 rows
-- finance_budgets: ~0 rows
-- finance_cashflow: ~0 rows
-- finance_cashflow_financing: ~0 rows
-- finance_cashflow_investing: ~0 rows
-- finance_cashflow_operating: ~3 rows
-- finance_customers: ~3 rows
-- finance_electronic_signatures: ~0 rows
-- finance_expenses: ~0 rows
-- finance_fixed_assets: ~0 rows
-- finance_invoice_lines: ~0 rows
-- finance_invoices: ~2 rows
-- finance_journal_entries: ~0 rows
-- finance_journal_lines: ~0 rows
-- finance_payment_allocations: ~0 rows
-- finance_payment_plans: ~0 rows
-- finance_payment_system_records: ~21 rows
-- finance_payments: ~0 rows
-- finance_payroll_bank_batches: ~0 rows
-- finance_payroll_components: ~0 rows
-- finance_payroll_employee_components: ~0 rows
-- finance_payroll_employee_insurance: ~0 rows
-- finance_payroll_employees: ~0 rows
-- finance_payroll_finance_deductions: ~0 rows
-- finance_payroll_finance_partners: ~0 rows
-- finance_payroll_flexible_rules: ~0 rows
-- finance_payroll_insurance_profiles: ~0 rows
-- finance_payroll_item_lines: ~0 rows
-- finance_payroll_items: ~0 rows
-- finance_payroll_overtime: ~0 rows