--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: tguser
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO tguser;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: tguser
--

COMMENT ON SCHEMA public IS '';


--
-- Name: DeviceType; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."DeviceType" AS ENUM (
    'ios',
    'android'
);


ALTER TYPE public."DeviceType" OWNER TO tguser;

--
-- Name: MerchantStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."MerchantStatus" AS ENUM (
    'active',
    'off'
);


ALTER TYPE public."MerchantStatus" OWNER TO tguser;

--
-- Name: ProductStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."ProductStatus" AS ENUM (
    'on',
    'off'
);


ALTER TYPE public."ProductStatus" OWNER TO tguser;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."Role" AS ENUM (
    'admin',
    'merchant',
    'vendor_user'
);


ALTER TYPE public."Role" OWNER TO tguser;

--
-- Name: SaleStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."SaleStatus" AS ENUM (
    'COMPLETED',
    'CANCELLED',
    'PENDING'
);


ALTER TYPE public."SaleStatus" OWNER TO tguser;

--
-- Name: SaleType; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."SaleType" AS ENUM (
    'ONLINE',
    'OFFLINE'
);


ALTER TYPE public."SaleType" OWNER TO tguser;

--
-- Name: TransactionStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."TransactionStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."TransactionStatus" OWNER TO tguser;

--
-- Name: VoucherStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."VoucherStatus" AS ENUM (
    'activated',
    'sold',
    'deleted',
    'active',
    'pending'
);


ALTER TYPE public."VoucherStatus" OWNER TO tguser;

--
-- Name: VoucherType; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."VoucherType" AS ENUM (
    'Telegram',
    'Vendor'
);


ALTER TYPE public."VoucherType" OWNER TO tguser;

--
-- Name: refresh_token_set_updated_at(); Type: FUNCTION; Schema: public; Owner: tguser
--

CREATE FUNCTION public.refresh_token_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.refresh_token_set_updated_at() OWNER TO tguser;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuthSmsLog; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."AuthSmsLog" (
    id integer NOT NULL,
    "phoneNumber" text NOT NULL,
    code text NOT NULL,
    "requestId" text NOT NULL,
    status text NOT NULL,
    "statusDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    response jsonb,
    verified boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone
);


ALTER TABLE public."AuthSmsLog" OWNER TO tguser;

--
-- Name: AuthSmsLog_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."AuthSmsLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AuthSmsLog_id_seq" OWNER TO tguser;

--
-- Name: AuthSmsLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."AuthSmsLog_id_seq" OWNED BY public."AuthSmsLog".id;


--
-- Name: Client; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Client" (
    id integer NOT NULL,
    name text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "phoneNumber" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Client" OWNER TO tguser;

--
-- Name: Client_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Client_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Client_id_seq" OWNER TO tguser;

--
-- Name: Client_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Client_id_seq" OWNED BY public."Client".id;


--
-- Name: Merchant; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Merchant" (
    id integer NOT NULL,
    username text NOT NULL,
    status public."MerchantStatus" DEFAULT 'active'::public."MerchantStatus" NOT NULL,
    "legalInfo" text NOT NULL,
    balance double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."Merchant" OWNER TO tguser;

--
-- Name: MerchantPayment; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."MerchantPayment" (
    id integer NOT NULL,
    "merchantId" integer NOT NULL,
    amount double precision NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "balanceAfter" double precision NOT NULL,
    "balanceBefore" double precision NOT NULL
);


ALTER TABLE public."MerchantPayment" OWNER TO tguser;

--
-- Name: MerchantPayment_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."MerchantPayment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MerchantPayment_id_seq" OWNER TO tguser;

--
-- Name: MerchantPayment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."MerchantPayment_id_seq" OWNED BY public."MerchantPayment".id;


--
-- Name: Merchant_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Merchant_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Merchant_id_seq" OWNER TO tguser;

--
-- Name: Merchant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Merchant_id_seq" OWNED BY public."Merchant".id;


--
-- Name: OnlineVoucher; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."OnlineVoucher" (
    id integer NOT NULL,
    "clientId" integer NOT NULL,
    "voucherId" integer NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."OnlineVoucher" OWNER TO tguser;

--
-- Name: OnlineVoucher_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."OnlineVoucher_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."OnlineVoucher_id_seq" OWNER TO tguser;

--
-- Name: OnlineVoucher_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."OnlineVoucher_id_seq" OWNED BY public."OnlineVoucher".id;


--
-- Name: Product; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Product" (
    id integer NOT NULL,
    name text NOT NULL,
    price double precision NOT NULL,
    "vendorId" integer NOT NULL,
    status text NOT NULL,
    "merchantCommissionPercent" double precision NOT NULL,
    "vendorCommissionPercent" double precision NOT NULL
);


ALTER TABLE public."Product" OWNER TO tguser;

--
-- Name: Product_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Product_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Product_id_seq" OWNER TO tguser;

--
-- Name: Product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Product_id_seq" OWNED BY public."Product".id;


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."RefreshToken" (
    id integer NOT NULL,
    "userId" integer,
    "clientId" integer,
    role text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RefreshToken" OWNER TO tguser;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."RefreshToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RefreshToken_id_seq" OWNER TO tguser;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."RefreshToken_id_seq" OWNED BY public."RefreshToken".id;


--
-- Name: Sale; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Sale" (
    id integer NOT NULL,
    "voucherValue" text NOT NULL,
    price double precision NOT NULL,
    "productId" integer NOT NULL,
    "productName" text NOT NULL,
    "merchantUsername" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receiptPath" text,
    status public."SaleStatus" DEFAULT 'COMPLETED'::public."SaleStatus" NOT NULL,
    "clientId" integer,
    "deliveryType" text,
    "saleType" public."SaleType" DEFAULT 'OFFLINE'::public."SaleType",
    "customerPhone" text
);


ALTER TABLE public."Sale" OWNER TO tguser;

--
-- Name: Sale_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Sale_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Sale_id_seq" OWNER TO tguser;

--
-- Name: Sale_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Sale_id_seq" OWNED BY public."Sale".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role public."Role" NOT NULL,
    note text,
    "vendorId" integer
);


ALTER TABLE public."User" OWNER TO tguser;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO tguser;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Vendor; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Vendor" (
    id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    "productType" text NOT NULL,
    "receiptTemplate" text,
    "defaultCommissionPercent" double precision DEFAULT 80 NOT NULL,
    balance double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."Vendor" OWNER TO tguser;

--
-- Name: VendorPayment; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."VendorPayment" (
    id integer NOT NULL,
    "vendorId" integer NOT NULL,
    amount double precision NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "balanceBefore" double precision NOT NULL,
    "balanceAfter" double precision NOT NULL
);


ALTER TABLE public."VendorPayment" OWNER TO tguser;

--
-- Name: VendorPayment_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."VendorPayment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."VendorPayment_id_seq" OWNER TO tguser;

--
-- Name: VendorPayment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."VendorPayment_id_seq" OWNED BY public."VendorPayment".id;


--
-- Name: Vendor_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Vendor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Vendor_id_seq" OWNER TO tguser;

--
-- Name: Vendor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Vendor_id_seq" OWNED BY public."Vendor".id;


--
-- Name: Voucher; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Voucher" (
    id integer NOT NULL,
    value text NOT NULL,
    status public."VoucherStatus" DEFAULT 'active'::public."VoucherStatus" NOT NULL,
    "productId" integer NOT NULL,
    "productName" text NOT NULL,
    type public."VoucherType" NOT NULL
);


ALTER TABLE public."Voucher" OWNER TO tguser;

--
-- Name: VoucherActivation; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."VoucherActivation" (
    id integer NOT NULL,
    "voucherId" integer NOT NULL,
    "activatedBy" integer,
    "vendorId" integer NOT NULL,
    "activatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "clientId" integer
);


ALTER TABLE public."VoucherActivation" OWNER TO tguser;

--
-- Name: VoucherActivation_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."VoucherActivation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."VoucherActivation_id_seq" OWNER TO tguser;

--
-- Name: VoucherActivation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."VoucherActivation_id_seq" OWNED BY public."VoucherActivation".id;


--
-- Name: VoucherSmsLog; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."VoucherSmsLog" (
    id integer NOT NULL,
    "voucherId" integer NOT NULL,
    "phoneNumber" text NOT NULL,
    message text NOT NULL,
    "requestId" text NOT NULL,
    status text NOT NULL,
    "statusDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    response jsonb
);


ALTER TABLE public."VoucherSmsLog" OWNER TO tguser;

--
-- Name: VoucherSmsLog_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."VoucherSmsLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."VoucherSmsLog_id_seq" OWNER TO tguser;

--
-- Name: VoucherSmsLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."VoucherSmsLog_id_seq" OWNED BY public."VoucherSmsLog".id;


--
-- Name: VoucherTransaction; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."VoucherTransaction" (
    id integer NOT NULL,
    "voucherValue" text NOT NULL,
    "merchantId" integer NOT NULL,
    "vendorId" integer NOT NULL,
    "productId" integer NOT NULL,
    "productName" text NOT NULL,
    price double precision NOT NULL,
    "merchantDebt" double precision NOT NULL,
    "adminDebt" double precision NOT NULL,
    status public."TransactionStatus" DEFAULT 'PENDING'::public."TransactionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "vendorDebt" double precision NOT NULL
);


ALTER TABLE public."VoucherTransaction" OWNER TO tguser;

--
-- Name: VoucherTransaction_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."VoucherTransaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."VoucherTransaction_id_seq" OWNER TO tguser;

--
-- Name: VoucherTransaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."VoucherTransaction_id_seq" OWNED BY public."VoucherTransaction".id;


--
-- Name: VoucherWalletLog; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."VoucherWalletLog" (
    id integer NOT NULL,
    "voucherId" integer NOT NULL,
    "clientId" integer NOT NULL,
    "isAddedToWallet" boolean DEFAULT false NOT NULL,
    "addedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pkpassId" text,
    "deviceInfo" public."DeviceType"
);


ALTER TABLE public."VoucherWalletLog" OWNER TO tguser;

--
-- Name: VoucherWalletLog_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."VoucherWalletLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."VoucherWalletLog_id_seq" OWNER TO tguser;

--
-- Name: VoucherWalletLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."VoucherWalletLog_id_seq" OWNED BY public."VoucherWalletLog".id;


--
-- Name: Voucher_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Voucher_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Voucher_id_seq" OWNER TO tguser;

--
-- Name: Voucher_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Voucher_id_seq" OWNED BY public."Voucher".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO tguser;

--
-- Name: AuthSmsLog id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."AuthSmsLog" ALTER COLUMN id SET DEFAULT nextval('public."AuthSmsLog_id_seq"'::regclass);


--
-- Name: Client id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Client" ALTER COLUMN id SET DEFAULT nextval('public."Client_id_seq"'::regclass);


--
-- Name: Merchant id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Merchant" ALTER COLUMN id SET DEFAULT nextval('public."Merchant_id_seq"'::regclass);


--
-- Name: MerchantPayment id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantPayment" ALTER COLUMN id SET DEFAULT nextval('public."MerchantPayment_id_seq"'::regclass);


--
-- Name: OnlineVoucher id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."OnlineVoucher" ALTER COLUMN id SET DEFAULT nextval('public."OnlineVoucher_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Product" ALTER COLUMN id SET DEFAULT nextval('public."Product_id_seq"'::regclass);


--
-- Name: RefreshToken id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RefreshToken" ALTER COLUMN id SET DEFAULT nextval('public."RefreshToken_id_seq"'::regclass);


--
-- Name: Sale id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Sale" ALTER COLUMN id SET DEFAULT nextval('public."Sale_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: Vendor id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Vendor" ALTER COLUMN id SET DEFAULT nextval('public."Vendor_id_seq"'::regclass);


--
-- Name: VendorPayment id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VendorPayment" ALTER COLUMN id SET DEFAULT nextval('public."VendorPayment_id_seq"'::regclass);


--
-- Name: Voucher id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Voucher" ALTER COLUMN id SET DEFAULT nextval('public."Voucher_id_seq"'::regclass);


--
-- Name: VoucherActivation id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherActivation" ALTER COLUMN id SET DEFAULT nextval('public."VoucherActivation_id_seq"'::regclass);


--
-- Name: VoucherSmsLog id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherSmsLog" ALTER COLUMN id SET DEFAULT nextval('public."VoucherSmsLog_id_seq"'::regclass);


--
-- Name: VoucherTransaction id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherTransaction" ALTER COLUMN id SET DEFAULT nextval('public."VoucherTransaction_id_seq"'::regclass);


--
-- Name: VoucherWalletLog id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherWalletLog" ALTER COLUMN id SET DEFAULT nextval('public."VoucherWalletLog_id_seq"'::regclass);


--
-- Data for Name: AuthSmsLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."AuthSmsLog" (id, "phoneNumber", code, "requestId", status, "statusDate", "createdAt", response, verified, "verifiedAt") FROM stdin;
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Client" (id, name, "createdAt", "phoneNumber", "updatedAt") FROM stdin;
6	\N	2025-10-11 09:43:54.648	+998998137861	2025-10-11 09:43:54.648
10	\N	2025-10-22 10:42:03.075	+998976050804	2025-10-22 10:42:03.075
11	\N	2025-10-23 18:16:46.133	+9988137861	2025-10-23 18:16:46.133
12	\N	2025-10-25 13:04:58.793	+998334007551	2025-10-25 13:04:58.793
13	\N	2025-10-31 12:43:53.288	+998	2025-10-31 12:43:53.288
14	\N	2025-11-03 15:30:06.92	+998909539988	2025-11-03 15:30:06.92
\.


--
-- Data for Name: Merchant; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Merchant" (id, username, status, "legalInfo", balance) FROM stdin;
5	tcm-corner2	active	TCM Aygerim	0
6	tcm-corner1	active	TCM Timur	655000
\.


--
-- Data for Name: MerchantPayment; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."MerchantPayment" (id, "merchantId", amount, comment, "createdAt", "balanceAfter", "balanceBefore") FROM stdin;
8	6	475000	test	2025-10-22 04:58:22.324	0	475000
\.


--
-- Data for Name: OnlineVoucher; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."OnlineVoucher" (id, "clientId", "voucherId", "assignedAt") FROM stdin;
9	10	312	2025-10-24 07:51:51.143
13	14	316	2025-11-03 15:30:06.933
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Product" (id, name, price, "vendorId", status, "merchantCommissionPercent", "vendorCommissionPercent") FROM stdin;
19	Test Product 1	100000	5	on	5	80
20	Test Product 2	200000	5	on	10	70
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."RefreshToken" (id, "userId", "clientId", role, token, "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Sale" (id, "voucherValue", price, "productId", "productName", "merchantUsername", date, "receiptPath", status, "clientId", "deliveryType", "saleType", "customerPhone") FROM stdin;
74	AAD6M3RG	100000	19	Test Product 1	tcm-corner1	2025-10-24 07:51:51.141	receipts/receipt-tcm-corner1-2025-10-24T07-51-51-108Z.pdf	COMPLETED	\N	\N	ONLINE	+998976050804
75	RRDC7DOD	200000	20	Test Product 2	tcm-corner1	2025-10-24 07:52:11.483	receipts/receipt-tcm-corner1-2025-10-24T07-52-11-478Z.pdf	COMPLETED	\N	\N	OFFLINE	\N
76	AAFU10QR	100000	19	Test Product 1	tcm-corner1	2025-10-25 11:16:32.743	receipts/receipt-tcm-corner1-2025-10-25T11-16-32-722Z.pdf	COMPLETED	\N	\N	OFFLINE	\N
77	AAO4R5P1	100000	19	Test Product 1	tcm-corner1	2025-10-29 13:40:31.585	receipts/receipt-tcm-corner1-2025-10-29T13-40-31-574Z.pdf	COMPLETED	\N	\N	OFFLINE	\N
78	AAAQCNL1	100000	19	Test Product 1	tcm-corner1	2025-10-29 16:30:26.535	receipts/receipt-tcm-corner1-2025-10-29T16-30-26-512Z.pdf	COMPLETED	\N	\N	OFFLINE	\N
79	AA5OAX29	100000	19	Test Product 1	tcm-corner1	2025-11-03 15:30:06.932	receipts/receipt-tcm-corner1-2025-11-03T15-30-06-917Z.pdf	COMPLETED	\N	\N	ONLINE	+998909539988
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."User" (id, username, password, role, note, "vendorId") FROM stdin;
9	office_admin1	$2b$10$1gZNkoBqRvh0Cxp4Fa0E2.zxFk9BJHYyxZ5iEsSVaza.t61ULEWNm	admin	\N	\N
10	vitamino_c1	$2b$10$x1LGdu3TLsdfuAeI8IMA6eX6SdCerHzoDTMp4CdFULhiC4NFDbGo2	merchant	\N	\N
11	tcm-corner1	$2b$10$HP9fFLF8RiDx/kcGt6uDBeLno0fiZExaMvXUgj0vpbhwCFdf/73zu	merchant	\N	\N
12	swiss_lab_bodomzor	$2b$10$zgjiO4mv.rjgjCSrUGSO7OWaCqAgwHjvAOUBXGyImrfnM8Vr9wyS6	vendor_user	Bodomzor filial	5
\.


--
-- Data for Name: Vendor; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Vendor" (id, name, category, description, "productType", "receiptTemplate", "defaultCommissionPercent", balance) FROM stdin;
5	Swiss Lab	Laboratory	Swiss Lab Laboratory	Ваучеры	{"version":1,"meta":{"title":"Swiss Lab Receipt"},"elements":[{"id":"heading","type":"heading","text":"Чек продажи","align":"center","showPrice":true,"showQty":true},{"id":"divider-1","type":"divider","align":"left","style":"dashed","showPrice":true,"showQty":true},{"id":"merchant-info","type":"text","text":"Продавец: {{merchant}}\\nВендор: {{vendorName}}\\nДата: {{date}}","align":"left","showPrice":true,"showQty":true},{"id":"items-table","type":"line-items","align":"left","showPrice":true,"showQty":true},{"id":"total","type":"total","align":"left","label":"Итого","showPrice":true,"showQty":true},{"id":"voucher-block","type":"text","text":"Ваучер: {{voucherMasked}}","align":"left","showPrice":true,"showQty":true},{"id":"qr-section","type":"qr","align":"left","showPrice":true,"showQty":true,"caption":"Сканируйте для активации"},{"id":"footer","type":"text","text":"Спасибо за покупку! Возврат невозможен.","align":"center","showPrice":true,"showQty":true}]}	80	160000
\.


--
-- Data for Name: VendorPayment; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VendorPayment" (id, "vendorId", amount, comment, "createdAt", "balanceBefore", "balanceAfter") FROM stdin;
\.


--
-- Data for Name: Voucher; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Voucher" (id, value, status, "productId", "productName", type) FROM stdin;
360	AAT84AFA	active	19	Test Product 1	Vendor
361	AAWOK7AH	active	19	Test Product 1	Vendor
363	RRNNHDPD	active	20	Test Product 2	Vendor
364	RRM2TA76	active	20	Test Product 2	Vendor
317	AAAUGZVS	active	19	Test Product 1	Vendor
318	AAPGDECN	active	19	Test Product 1	Vendor
319	AA1WNP07	active	19	Test Product 1	Vendor
320	AAAGQ3M2	active	19	Test Product 1	Vendor
321	AA3QBV3Q	active	19	Test Product 1	Vendor
322	AAL3XOZX	active	19	Test Product 1	Vendor
323	AAJ28Q8H	active	19	Test Product 1	Vendor
324	AANK9ZZG	active	19	Test Product 1	Vendor
325	AA3LQ34D	active	19	Test Product 1	Vendor
326	AAKTHR90	active	19	Test Product 1	Vendor
327	AA2UFTAP	active	19	Test Product 1	Vendor
328	AAGBQBJH	active	19	Test Product 1	Vendor
329	AATRLS42	active	19	Test Product 1	Vendor
330	AA5FTF6Q	active	19	Test Product 1	Vendor
331	AAK7M44G	active	19	Test Product 1	Vendor
332	AARYY2U1	active	19	Test Product 1	Vendor
333	AAA50H1C	active	19	Test Product 1	Vendor
334	AAL8FWZ0	active	19	Test Product 1	Vendor
335	AA78H9LJ	active	19	Test Product 1	Vendor
336	AA17UE17	active	19	Test Product 1	Vendor
337	AALAWP10	active	19	Test Product 1	Vendor
338	AA2UNBKK	active	19	Test Product 1	Vendor
339	AAEHPJRH	active	19	Test Product 1	Vendor
340	AA2509T5	active	19	Test Product 1	Vendor
341	AAG3L07F	active	19	Test Product 1	Vendor
342	AA5O0CX4	active	19	Test Product 1	Vendor
343	AAV8ANAM	active	19	Test Product 1	Vendor
344	AATOHPMH	active	19	Test Product 1	Vendor
345	AA0N2Z62	active	19	Test Product 1	Vendor
346	AA88M0PQ	active	19	Test Product 1	Vendor
347	AAHWXMEK	active	19	Test Product 1	Vendor
348	AAB57O9V	active	19	Test Product 1	Vendor
349	AAV64Y35	active	19	Test Product 1	Vendor
350	AAYNE27K	active	19	Test Product 1	Vendor
351	AAGNMCXY	active	19	Test Product 1	Vendor
352	AATVSCDV	active	19	Test Product 1	Vendor
353	AAS1CBDA	active	19	Test Product 1	Vendor
354	AAGQLSD5	active	19	Test Product 1	Vendor
355	AAAZSV0Q	active	19	Test Product 1	Vendor
356	AA1N2Z9O	active	19	Test Product 1	Vendor
357	AANCUDYQ	active	19	Test Product 1	Vendor
358	AAG59SJF	active	19	Test Product 1	Vendor
359	AA7WU3E2	active	19	Test Product 1	Vendor
365	RRB9PSV8	active	20	Test Product 2	Vendor
366	RRRSBHCF	active	20	Test Product 2	Vendor
367	RRG9XBQQ	active	20	Test Product 2	Vendor
368	RRYF75B3	active	20	Test Product 2	Vendor
369	RRXR3VHH	active	20	Test Product 2	Vendor
370	RRLWZFPD	active	20	Test Product 2	Vendor
371	RR9O0H4T	active	20	Test Product 2	Vendor
372	RR5H6BZJ	active	20	Test Product 2	Vendor
373	RR00WFQL	active	20	Test Product 2	Vendor
374	RR9PLFYG	active	20	Test Product 2	Vendor
375	RR7MB72Z	active	20	Test Product 2	Vendor
376	RRKU4UJT	active	20	Test Product 2	Vendor
377	RRGPXPM6	active	20	Test Product 2	Vendor
378	RRGRURRT	active	20	Test Product 2	Vendor
379	RRA50XYO	active	20	Test Product 2	Vendor
380	RRKWN3OE	active	20	Test Product 2	Vendor
381	RRZ5D4SN	active	20	Test Product 2	Vendor
382	RREX1ETW	active	20	Test Product 2	Vendor
383	RR64ZTMS	active	20	Test Product 2	Vendor
384	RR2W48PV	active	20	Test Product 2	Vendor
385	RRHUW7TA	active	20	Test Product 2	Vendor
386	RRCOJ0BG	active	20	Test Product 2	Vendor
387	RRFN18JB	active	20	Test Product 2	Vendor
388	RRL5OFY1	active	20	Test Product 2	Vendor
389	RRG2H5MO	active	20	Test Product 2	Vendor
390	RR3ZZUNX	active	20	Test Product 2	Vendor
391	RRK631FN	active	20	Test Product 2	Vendor
392	RR6W83P5	active	20	Test Product 2	Vendor
393	RR7VNWZ5	active	20	Test Product 2	Vendor
394	RR30ST66	active	20	Test Product 2	Vendor
395	RRJMZ0S5	active	20	Test Product 2	Vendor
396	RR1J51FN	active	20	Test Product 2	Vendor
397	RRMZF2GC	active	20	Test Product 2	Vendor
398	RRD0ERLF	active	20	Test Product 2	Vendor
399	RR7UQSF1	active	20	Test Product 2	Vendor
400	RR17P5MZ	active	20	Test Product 2	Vendor
401	RR1FB3YS	active	20	Test Product 2	Vendor
402	RRHXLBKM	active	20	Test Product 2	Vendor
403	RRYEDXMP	active	20	Test Product 2	Vendor
404	RR1WU974	active	20	Test Product 2	Vendor
405	RRSDXFK8	active	20	Test Product 2	Vendor
406	RR6W6O2O	active	20	Test Product 2	Vendor
407	RR86CXA3	active	20	Test Product 2	Vendor
408	RRL8Z5N7	active	20	Test Product 2	Vendor
409	RRMVKE9B	active	20	Test Product 2	Vendor
410	RRZ4OSTQ	active	20	Test Product 2	Vendor
411	RR6B94N8	active	20	Test Product 2	Vendor
312	AAD6M3RG	sold	19	Test Product 1	Vendor
315	AAAQCNL1	sold	19	Test Product 1	Vendor
362	RRDC7DOD	activated	20	Test Product 2	Vendor
313	AAFU10QR	activated	19	Test Product 1	Vendor
314	AAO4R5P1	activated	19	Test Product 1	Vendor
316	AA5OAX29	sold	19	Test Product 1	Vendor
\.


--
-- Data for Name: VoucherActivation; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherActivation" (id, "voucherId", "activatedBy", "vendorId", "activatedAt", "clientId") FROM stdin;
8	314	12	5	2025-10-29 13:48:01.797	6
9	313	12	5	2025-10-29 13:48:41.382	6
10	362	12	5	2025-10-29 13:48:57.587	6
\.


--
-- Data for Name: VoucherSmsLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherSmsLog" (id, "voucherId", "phoneNumber", message, "requestId", status, "statusDate", "createdAt", response) FROM stdin;
8	312	+998976050804	Dobavlen noviy vaucher | Yangi vaucher qo'shildi wallet.namo.uz	8555149a-bd3d-4e19-8318-921fbde86139	delivered	2025-10-24 07:51:51.603	2025-10-24 07:51:51.604	{"data": {"id": "8555149a-bd3d-4e19-8318-921fbde86139", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "8555149a-bd3d-4e19-8318-921fbde86139", "success": true}
9	316	+998909539988	Dobavlen noviy vaucher | Yangi vaucher qo'shildi wallet.namo.uz	3a065bf9-9c1c-4cd1-b65a-78b639d505bf	delivered	2025-11-03 15:30:07.245	2025-11-03 15:30:07.246	{"data": {"id": "3a065bf9-9c1c-4cd1-b65a-78b639d505bf", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "3a065bf9-9c1c-4cd1-b65a-78b639d505bf", "success": true}
\.


--
-- Data for Name: VoucherTransaction; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherTransaction" (id, "voucherValue", "merchantId", "vendorId", "productId", "productName", price, "merchantDebt", "adminDebt", status, "createdAt", "vendorDebt") FROM stdin;
56	RRDC7DOD	6	5	20	Test Product 2	200000	180000	140000	COMPLETED	2025-10-24 07:52:11.484	60000.00000000001
59	AAAQCNL1	6	5	19	Test Product 1	100000	95000	80000	PENDING	2025-10-29 16:30:26.536	20000
60	AA5OAX29	6	5	19	Test Product 1	100000	95000	80000	PENDING	2025-11-03 15:30:06.938	20000
55	AAD6M3RG	6	5	19	Test Product 1	100000	95000	80000	PENDING	2025-10-24 07:51:51.157	20000
58	AAO4R5P1	6	5	19	Test Product 1	100000	95000	80000	COMPLETED	2025-10-29 13:40:31.586	20000
57	AAFU10QR	6	5	19	Test Product 1	100000	95000	80000	COMPLETED	2025-10-25 11:16:32.745	20000
\.


--
-- Data for Name: VoucherWalletLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherWalletLog" (id, "voucherId", "clientId", "isAddedToWallet", "addedAt", "pkpassId", "deviceInfo") FROM stdin;
72	312	10	t	2025-10-24 07:51:51.151	\N	\N
73	362	6	t	2025-10-25 09:38:33.961	voucher.claim_qr	\N
74	362	6	f	2025-10-25 09:38:34.32	voucher.qr_show	\N
75	362	6	f	2025-10-25 09:41:12.79	voucher.view	\N
76	362	6	t	2025-10-25 09:41:18.736	voucher.add_to_wallet	android
77	362	6	f	2025-10-25 09:41:21.346	voucher.share	\N
78	362	6	f	2025-10-25 09:41:26.511	voucher.view	\N
79	362	6	f	2025-10-25 11:01:08.962	voucher.view	\N
80	313	6	t	2025-10-25 13:03:23.101	voucher.claim_qr	\N
81	313	6	f	2025-10-25 13:03:23.584	voucher.qr_show	\N
82	313	6	f	2025-10-25 13:03:56.709	voucher.qr_show	\N
83	313	6	f	2025-10-29 13:29:58.125	voucher.view	\N
84	362	6	f	2025-10-29 13:30:00.68	voucher.view	\N
85	362	6	f	2025-10-29 13:30:20.394	voucher.view	\N
86	314	6	t	2025-10-29 13:41:12.898	voucher.claim_qr	\N
87	314	6	f	2025-10-29 13:41:13.243	voucher.qr_show	\N
88	314	6	f	2025-10-29 13:41:25.21	voucher.view	\N
89	314	6	f	2025-10-29 13:41:33.223	voucher.qr_show	\N
90	314	6	f	2025-10-29 13:47:33.548	voucher.view	\N
91	314	6	f	2025-10-29 13:48:01.8	voucher.activated_vendor	\N
92	313	6	f	2025-10-29 13:48:32.11	voucher.view	\N
93	313	6	f	2025-10-29 13:48:41.383	voucher.activated_vendor	\N
94	362	6	f	2025-10-29 13:48:47.23	voucher.view	\N
95	362	6	f	2025-10-29 13:48:57.588	voucher.activated_vendor	\N
96	316	14	t	2025-11-03 15:30:06.935	\N	\N
97	316	14	f	2025-11-03 15:33:18.416	voucher.view	\N
98	316	14	f	2025-11-03 15:35:23.964	voucher.view	\N
99	316	14	t	2025-11-03 15:35:29.197	voucher.add_to_wallet	ios
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
9fdc932a-068d-465d-8e1b-56bbda8b3bdd	caeddb15d9512702c685d077e1ac035a2622c5f40ca15994bcbbe9ba8c3f43b4	2025-04-09 14:32:36.923459+00	20250404134644_	\N	\N	2025-04-09 14:32:36.893863+00	1
a58116cc-fe78-43ae-a12a-c31e60274b8e	b9882541f72250116c198caa7aa82e043fc0a5eda2026b04b9a9d6ad01a08442	2025-04-09 14:32:53.040986+00	20250409143253_fix_voucher_relation	\N	\N	2025-04-09 14:32:53.029778+00	1
59e6c37e-1fcc-4c5b-9f4f-1ca2fceeafea	d1589459655a5f45be13af7efebcbbb8d45f2c849d3ed3c0ad5166eb251e0a73	2025-07-09 07:27:07.552383+00	20250709072707_add_vendor_debt	\N	\N	2025-07-09 07:27:07.549054+00	1
9d286b0e-1113-42bc-9aaa-472c04987218	008378fced374dfbfe16193e015d4c354f8833a45849b03a61e3c983dc5ed76d	2025-04-10 14:46:05.501041+00	20250410144605_multi_sale_checkout	\N	\N	2025-04-10 14:46:05.49257+00	1
a8242282-8d0d-480b-a053-16a56e007c07	2052d274685f976d8f85b5cc177abd74f1fdb07b2fccbbbc8af490c1eddfbcbe	2025-04-12 06:24:35.383717+00	20250412062435_add_receipt_path_to_sale	\N	\N	2025-04-12 06:24:35.373487+00	1
a1465a75-ac0a-40ec-897a-5edef90f6212	7b9ca839fdfcf817b4302b251c1e0c38a70bdfa1d446d2f0711ee471836bb1ac	2025-04-14 09:20:35.481811+00	20250414092035_add_vendor_receipt_template	\N	\N	2025-04-14 09:20:35.463325+00	1
c59cf58a-7785-4462-96c5-45c77554dade	d4c882f77110b474ef04ced0d375c9a709d6674e142205575321d4b0269ca034	2025-05-24 13:49:49.270641+00	20250524134949_allow_null_vendor_commission	\N	\N	2025-05-24 13:49:49.252935+00	1
cea3fe71-f435-4065-9a5a-6815375531d4	7aa7617c3e309435ca8313b0c3e6242800af375fa7f08347163df69a6a312a62	2025-07-05 08:47:44.670367+00	20250705084744_add_vendor_user_role	\N	\N	2025-07-05 08:47:44.656928+00	1
cc2e0c0a-e03a-4e31-911a-c7fea5b8084c	9cfd0be4691ebb4f006145d2314dbd15480f5e22ea54b6b2fe76d0a9b485d9df	2025-07-05 12:10:55.793062+00	20250705121055_add_product_commissions	\N	\N	2025-07-05 12:10:55.789459+00	1
909cfb51-41a0-4127-8692-4cc4e1b95285	8cb71c522ced91cd08c194e6e6e4ef811289393e4b8718d36ef245f3f62c8b92	2025-07-08 09:58:30.451034+00	20250708095830_add_merchant_balance_history	\N	\N	2025-07-08 09:58:30.447437+00	1
581d6625-772f-4fb2-97d6-b9c67a92b777	4c8e34440fba3daa9df1df79050972384c85e0b3dfb8bb8f7ff26d5ed7132ea5	2025-07-08 12:43:24.603031+00	20250708124324_add_vendor_payment	\N	\N	2025-07-08 12:43:24.585785+00	1
ec342eba-834f-4b3a-9379-ea76cbeadd0a	376c0c2651e78c0adea12a9809670640695949994451d3cb97da3536e7d8b81d	2025-07-08 13:58:01.768679+00	20250708135801_add_balance_to_vendor	\N	\N	2025-07-08 13:58:01.763056+00	1
bafb3f97-2bbf-4b9f-9053-bb7692df20b0	90ecb8270b4ff6484e507db7bcc453df6c1491fdf21bd7c9728023a31dad56c1	2025-07-08 14:44:34.896382+00	20250708144434_remove_vendor_commission_from_product	\N	\N	2025-07-08 14:44:34.892912+00	1
7acfa82e-cb01-45e8-b699-79515de9b53a	9e06009f5b4c5d68728a641b996c64890fa71377cc32d5aa5eadb12e3fd5bb84	2025-07-08 15:24:16.69551+00	20250708152416_add_product_commissions	\N	\N	2025-07-08 15:24:16.691537+00	1
c0f4518b-6431-4878-a4b5-35b0dc7152e5	c2e571307a7f43e76cd52519a912f1f79115a9e1f7c24f485b4a45d9ac3a737c	2025-07-19 07:33:12.474794+00	20250719073312_add_new_tables	\N	\N	2025-07-19 07:33:12.447613+00	1
8923afea-d432-4669-9d97-5f0173dc502f	b7c0d21555d41c9a08c06d4aa169260d209a2b61422a583f9727eab0312517f9	2025-09-15 19:56:43.721361+00	20250719123157_rename_phone_to_phonenumber	\N	\N	2025-09-15 19:56:43.692252+00	1
870b1081-fd44-40f1-adba-c6243f1503b5	b125cd6dde5e030c031368eb8a7a5a38d333e4ff571c0f0a5e204bc59a54266f	2025-09-15 19:56:43.746385+00	20250726123946_add_updated_at_to_client	\N	\N	2025-09-15 19:56:43.723593+00	1
bdb1dde0-0b16-4305-adba-64f87fbb25d4	821c2cf25957dd36008b78996ddc9c0891a8967513872399744116ef1668fc56	2025-09-15 19:56:43.751495+00	20250729101240_add_delivery_type_and_client_to_sale	\N	\N	2025-09-15 19:56:43.747107+00	1
4b218a1e-c5bb-4b58-af61-2e98841ca672	3bdd22bf8d3a1973d592b01b03af43767809bfbea65b5ebf7eb6cbcc2f8612cb	2025-10-23 05:14:38.900328+00	20250211120000_add_refresh_token	\N	\N	2025-10-23 05:14:38.836465+00	1
\.


--
-- Name: AuthSmsLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."AuthSmsLog_id_seq"', 1, false);


--
-- Name: Client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Client_id_seq"', 14, true);


--
-- Name: MerchantPayment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."MerchantPayment_id_seq"', 8, true);


--
-- Name: Merchant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Merchant_id_seq"', 6, true);


--
-- Name: OnlineVoucher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."OnlineVoucher_id_seq"', 13, true);


--
-- Name: Product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Product_id_seq"', 20, true);


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 29, true);


--
-- Name: Sale_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Sale_id_seq"', 79, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."User_id_seq"', 12, true);


--
-- Name: VendorPayment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VendorPayment_id_seq"', 2, true);


--
-- Name: Vendor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Vendor_id_seq"', 5, true);


--
-- Name: VoucherActivation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherActivation_id_seq"', 10, true);


--
-- Name: VoucherSmsLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherSmsLog_id_seq"', 9, true);


--
-- Name: VoucherTransaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherTransaction_id_seq"', 60, true);


--
-- Name: VoucherWalletLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherWalletLog_id_seq"', 99, true);


--
-- Name: Voucher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Voucher_id_seq"', 411, true);


--
-- Name: AuthSmsLog AuthSmsLog_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."AuthSmsLog"
    ADD CONSTRAINT "AuthSmsLog_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: MerchantPayment MerchantPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantPayment"
    ADD CONSTRAINT "MerchantPayment_pkey" PRIMARY KEY (id);


--
-- Name: Merchant Merchant_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Merchant"
    ADD CONSTRAINT "Merchant_pkey" PRIMARY KEY (id);


--
-- Name: OnlineVoucher OnlineVoucher_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."OnlineVoucher"
    ADD CONSTRAINT "OnlineVoucher_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: Sale Sale_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VendorPayment VendorPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VendorPayment"
    ADD CONSTRAINT "VendorPayment_pkey" PRIMARY KEY (id);


--
-- Name: Vendor Vendor_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Vendor"
    ADD CONSTRAINT "Vendor_pkey" PRIMARY KEY (id);


--
-- Name: VoucherActivation VoucherActivation_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherActivation"
    ADD CONSTRAINT "VoucherActivation_pkey" PRIMARY KEY (id);


--
-- Name: VoucherSmsLog VoucherSmsLog_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherSmsLog"
    ADD CONSTRAINT "VoucherSmsLog_pkey" PRIMARY KEY (id);


--
-- Name: VoucherTransaction VoucherTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherTransaction"
    ADD CONSTRAINT "VoucherTransaction_pkey" PRIMARY KEY (id);


--
-- Name: VoucherWalletLog VoucherWalletLog_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherWalletLog"
    ADD CONSTRAINT "VoucherWalletLog_pkey" PRIMARY KEY (id);


--
-- Name: Voucher Voucher_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Voucher"
    ADD CONSTRAINT "Voucher_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Client_phoneNumber_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "Client_phoneNumber_key" ON public."Client" USING btree ("phoneNumber");


--
-- Name: Merchant_username_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "Merchant_username_key" ON public."Merchant" USING btree (username);


--
-- Name: OnlineVoucher_voucherId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "OnlineVoucher_voucherId_key" ON public."OnlineVoucher" USING btree ("voucherId");


--
-- Name: RefreshToken_clientId_role_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "RefreshToken_clientId_role_key" ON public."RefreshToken" USING btree ("clientId", role);


--
-- Name: RefreshToken_token_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "RefreshToken_token_key" ON public."RefreshToken" USING btree (token);


--
-- Name: RefreshToken_userId_role_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "RefreshToken_userId_role_key" ON public."RefreshToken" USING btree ("userId", role);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: Voucher_value_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "Voucher_value_key" ON public."Voucher" USING btree (value);


--
-- Name: RefreshToken refresh_token_set_updated_at; Type: TRIGGER; Schema: public; Owner: tguser
--

CREATE TRIGGER refresh_token_set_updated_at BEFORE UPDATE ON public."RefreshToken" FOR EACH ROW EXECUTE FUNCTION public.refresh_token_set_updated_at();


--
-- Name: MerchantPayment MerchantPayment_merchantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantPayment"
    ADD CONSTRAINT "MerchantPayment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES public."Merchant"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OnlineVoucher OnlineVoucher_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."OnlineVoucher"
    ADD CONSTRAINT "OnlineVoucher_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OnlineVoucher OnlineVoucher_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."OnlineVoucher"
    ADD CONSTRAINT "OnlineVoucher_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public."Voucher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RefreshToken RefreshToken_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Sale Sale_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VendorPayment VendorPayment_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VendorPayment"
    ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherActivation VoucherActivation_activatedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherActivation"
    ADD CONSTRAINT "VoucherActivation_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VoucherActivation VoucherActivation_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherActivation"
    ADD CONSTRAINT "VoucherActivation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VoucherActivation VoucherActivation_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherActivation"
    ADD CONSTRAINT "VoucherActivation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherActivation VoucherActivation_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherActivation"
    ADD CONSTRAINT "VoucherActivation_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public."Voucher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherSmsLog VoucherSmsLog_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherSmsLog"
    ADD CONSTRAINT "VoucherSmsLog_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public."Voucher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherTransaction VoucherTransaction_merchantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherTransaction"
    ADD CONSTRAINT "VoucherTransaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES public."Merchant"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherTransaction VoucherTransaction_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherTransaction"
    ADD CONSTRAINT "VoucherTransaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherWalletLog VoucherWalletLog_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherWalletLog"
    ADD CONSTRAINT "VoucherWalletLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VoucherWalletLog VoucherWalletLog_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."VoucherWalletLog"
    ADD CONSTRAINT "VoucherWalletLog_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public."Voucher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Voucher Voucher_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Voucher"
    ADD CONSTRAINT "Voucher_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: tguser
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

