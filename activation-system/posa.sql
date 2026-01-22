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
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
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
-- Name: ManualActivationStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."ManualActivationStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."ManualActivationStatus" OWNER TO tguser;

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
-- Name: QrPaymentStatus; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."QrPaymentStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'PAID',
    'EXPIRED',
    'FAILED'
);


ALTER TYPE public."QrPaymentStatus" OWNER TO tguser;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."Role" AS ENUM (
    'admin',
    'merchant',
    'vendor_user',
    'financial_mgr',
    'content_mgr',
    'support_agent'
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
-- Name: VendorProductType; Type: TYPE; Schema: public; Owner: tguser
--

CREATE TYPE public."VendorProductType" AS ENUM (
    'ROKKY',
    'MANUAL',
    'VOUCHER'
);


ALTER TYPE public."VendorProductType" OWNER TO tguser;

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
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."AuditLog" (
    id integer NOT NULL,
    "actorUserId" integer,
    role text NOT NULL,
    action text NOT NULL,
    "entityType" text,
    details jsonb,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO tguser;

--
-- Name: AuditLog_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."AuditLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AuditLog_id_seq" OWNER TO tguser;

--
-- Name: AuditLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."AuditLog_id_seq" OWNED BY public."AuditLog".id;


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
-- Name: ManualActivationRequest; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."ManualActivationRequest" (
    id integer NOT NULL,
    "voucherId" integer NOT NULL,
    status public."ManualActivationStatus" DEFAULT 'PENDING'::public."ManualActivationStatus" NOT NULL,
    key text,
    "operatorId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ManualActivationRequest" OWNER TO tguser;

--
-- Name: ManualActivationRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."ManualActivationRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ManualActivationRequest_id_seq" OWNER TO tguser;

--
-- Name: ManualActivationRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."ManualActivationRequest_id_seq" OWNED BY public."ManualActivationRequest".id;


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
-- Name: MerchantProductLink; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."MerchantProductLink" (
    id integer NOT NULL,
    "merchantId" integer NOT NULL,
    "productId" integer NOT NULL,
    token text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MerchantProductLink" OWNER TO tguser;

--
-- Name: MerchantProductLink_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."MerchantProductLink_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MerchantProductLink_id_seq" OWNER TO tguser;

--
-- Name: MerchantProductLink_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."MerchantProductLink_id_seq" OWNED BY public."MerchantProductLink".id;


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
    "vendorCommissionPercent" double precision NOT NULL,
    "rokkySku" text,
    "storeId" integer,
    "receiptTemplate" text
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
-- Name: QrPaymentAttempt; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."QrPaymentAttempt" (
    id integer NOT NULL,
    "linkId" integer NOT NULL,
    "phoneNumber" text NOT NULL,
    amount double precision NOT NULL,
    "paymentMethod" text,
    status public."QrPaymentStatus" DEFAULT 'PENDING'::public."QrPaymentStatus" NOT NULL,
    "externalPaymentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "saleId" integer,
    "voucherValue" text,
    "receiptPath" text,
    "cancelReason" integer,
    "cancelTime" timestamp(3) without time zone
);


ALTER TABLE public."QrPaymentAttempt" OWNER TO tguser;

--
-- Name: QrPaymentAttempt_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."QrPaymentAttempt_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."QrPaymentAttempt_id_seq" OWNER TO tguser;

--
-- Name: QrPaymentAttempt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."QrPaymentAttempt_id_seq" OWNED BY public."QrPaymentAttempt".id;


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
    "updatedAt" timestamp(3) without time zone NOT NULL
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
-- Name: RokkyApiLog; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."RokkyApiLog" (
    id integer NOT NULL,
    method text NOT NULL,
    sku text,
    "referenceId" text,
    "requestData" text,
    "responseData" text,
    "statusCode" integer,
    success boolean NOT NULL,
    "errorMessage" text,
    duration integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RokkyApiLog" OWNER TO tguser;

--
-- Name: RokkyApiLog_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."RokkyApiLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RokkyApiLog_id_seq" OWNER TO tguser;

--
-- Name: RokkyApiLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."RokkyApiLog_id_seq" OWNED BY public."RokkyApiLog".id;


--
-- Name: RokkyOrder; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."RokkyOrder" (
    id integer NOT NULL,
    "rokkyOrderId" text NOT NULL,
    "voucherId" integer NOT NULL,
    status text NOT NULL,
    key text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "errorMessage" text,
    sku text NOT NULL
);


ALTER TABLE public."RokkyOrder" OWNER TO tguser;

--
-- Name: RokkyOrder_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."RokkyOrder_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RokkyOrder_id_seq" OWNER TO tguser;

--
-- Name: RokkyOrder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."RokkyOrder_id_seq" OWNED BY public."RokkyOrder".id;


--
-- Name: RokkySku; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."RokkySku" (
    id integer NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    "costPrice" double precision,
    "retailPrice" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."RokkySku" OWNER TO tguser;

--
-- Name: RokkySku_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."RokkySku_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RokkySku_id_seq" OWNER TO tguser;

--
-- Name: RokkySku_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."RokkySku_id_seq" OWNED BY public."RokkySku".id;


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
    "saleType" public."SaleType" DEFAULT 'OFFLINE'::public."SaleType" NOT NULL,
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
-- Name: Store; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."Store" (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "backgroundColor" text DEFAULT '#F8FAFC'::text,
    "logoUrl" text,
    "themeColor" text DEFAULT '#4F46E5'::text,
    "activationSmsTemplate" text DEFAULT 'Vash vaucher aktivirovan | Sizning vaucheringiz faollashtirildi https://namo.uz/link'::text
);


ALTER TABLE public."Store" OWNER TO tguser;

--
-- Name: StoreTelegramBot; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."StoreTelegramBot" (
    id integer NOT NULL,
    "storeId" integer NOT NULL,
    "telegramBotId" integer NOT NULL
);


ALTER TABLE public."StoreTelegramBot" OWNER TO tguser;

--
-- Name: StoreTelegramBot_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."StoreTelegramBot_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."StoreTelegramBot_id_seq" OWNER TO tguser;

--
-- Name: StoreTelegramBot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."StoreTelegramBot_id_seq" OWNED BY public."StoreTelegramBot".id;


--
-- Name: Store_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."Store_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Store_id_seq" OWNER TO tguser;

--
-- Name: Store_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."Store_id_seq" OWNED BY public."Store".id;


--
-- Name: TelegramBot; Type: TABLE; Schema: public; Owner: tguser
--

CREATE TABLE public."TelegramBot" (
    id integer NOT NULL,
    name text NOT NULL,
    token text NOT NULL,
    "authorizedUsers" text DEFAULT '[]'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TelegramBot" OWNER TO tguser;

--
-- Name: TelegramBot_id_seq; Type: SEQUENCE; Schema: public; Owner: tguser
--

CREATE SEQUENCE public."TelegramBot_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TelegramBot_id_seq" OWNER TO tguser;

--
-- Name: TelegramBot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tguser
--

ALTER SEQUENCE public."TelegramBot_id_seq" OWNED BY public."TelegramBot".id;


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
    "productType" public."VendorProductType" NOT NULL,
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
-- Name: AuditLog id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."AuditLog" ALTER COLUMN id SET DEFAULT nextval('public."AuditLog_id_seq"'::regclass);


--
-- Name: AuthSmsLog id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."AuthSmsLog" ALTER COLUMN id SET DEFAULT nextval('public."AuthSmsLog_id_seq"'::regclass);


--
-- Name: Client id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Client" ALTER COLUMN id SET DEFAULT nextval('public."Client_id_seq"'::regclass);


--
-- Name: ManualActivationRequest id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."ManualActivationRequest" ALTER COLUMN id SET DEFAULT nextval('public."ManualActivationRequest_id_seq"'::regclass);


--
-- Name: Merchant id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Merchant" ALTER COLUMN id SET DEFAULT nextval('public."Merchant_id_seq"'::regclass);


--
-- Name: MerchantPayment id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantPayment" ALTER COLUMN id SET DEFAULT nextval('public."MerchantPayment_id_seq"'::regclass);


--
-- Name: MerchantProductLink id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantProductLink" ALTER COLUMN id SET DEFAULT nextval('public."MerchantProductLink_id_seq"'::regclass);


--
-- Name: OnlineVoucher id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."OnlineVoucher" ALTER COLUMN id SET DEFAULT nextval('public."OnlineVoucher_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Product" ALTER COLUMN id SET DEFAULT nextval('public."Product_id_seq"'::regclass);


--
-- Name: QrPaymentAttempt id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."QrPaymentAttempt" ALTER COLUMN id SET DEFAULT nextval('public."QrPaymentAttempt_id_seq"'::regclass);


--
-- Name: RefreshToken id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RefreshToken" ALTER COLUMN id SET DEFAULT nextval('public."RefreshToken_id_seq"'::regclass);


--
-- Name: RokkyApiLog id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkyApiLog" ALTER COLUMN id SET DEFAULT nextval('public."RokkyApiLog_id_seq"'::regclass);


--
-- Name: RokkyOrder id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkyOrder" ALTER COLUMN id SET DEFAULT nextval('public."RokkyOrder_id_seq"'::regclass);


--
-- Name: RokkySku id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkySku" ALTER COLUMN id SET DEFAULT nextval('public."RokkySku_id_seq"'::regclass);


--
-- Name: Sale id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Sale" ALTER COLUMN id SET DEFAULT nextval('public."Sale_id_seq"'::regclass);


--
-- Name: Store id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Store" ALTER COLUMN id SET DEFAULT nextval('public."Store_id_seq"'::regclass);


--
-- Name: StoreTelegramBot id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."StoreTelegramBot" ALTER COLUMN id SET DEFAULT nextval('public."StoreTelegramBot_id_seq"'::regclass);


--
-- Name: TelegramBot id; Type: DEFAULT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."TelegramBot" ALTER COLUMN id SET DEFAULT nextval('public."TelegramBot_id_seq"'::regclass);


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
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."AuditLog" (id, "actorUserId", role, action, "entityType", details, ip, "createdAt") FROM stdin;
8	\N	client	CLIENT_ACCOUNT_DELETED	Client	{"clientId": 20, "timestamp": "2025-12-15T15:19:44.789Z", "originalPhone": "+998003332222", "anonymizedPhone": "deleted_1765811984780_gvq6rc"}	127.0.0.1	2025-12-15 15:19:44.791
9	\N	client	CLIENT_ACCOUNT_DELETED	Client	{"clientId": 17, "timestamp": "2025-12-15T15:45:10.913Z", "originalPhone": "+998334007551", "anonymizedPhone": "deleted_1765813510910_73kalq"}	104.28.107.33	2025-12-15 15:45:10.915
10	\N	client	CLIENT_ACCOUNT_DELETED	Client	{"clientId": 22, "timestamp": "2025-12-15T15:45:48.985Z", "originalPhone": "+998334007551", "anonymizedPhone": "deleted_1765813548981_ykleun"}	104.28.107.33	2025-12-15 15:45:48.987
11	\N	client	CLIENT_ACCOUNT_DELETED	Client	{"clientId": 24, "timestamp": "2025-12-16T05:14:35.581Z", "originalPhone": "+998337017755", "anonymizedPhone": "deleted_1765862075574_d8o6uh"}	62.164.155.224	2025-12-16 05:14:35.582
\.


--
-- Data for Name: AuthSmsLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."AuthSmsLog" (id, "phoneNumber", code, "requestId", status, "statusDate", "createdAt", response, verified, "verifiedAt") FROM stdin;
23	+998998137861	716820	512c7811-e2d3-4277-96da-93a58223cfc5	delivered	\N	2025-12-08 11:19:44.877	{"id": "512c7811-e2d3-4277-96da-93a58223cfc5", "status": "waiting", "message": "Waiting for SMS provider"}	t	2025-12-08 11:20:01.13
24	+998998137861	230965	e1601e3f-168b-436e-a164-ded6c173b8be	delivered	\N	2025-12-08 11:22:59.287	{"id": "e1601e3f-168b-436e-a164-ded6c173b8be", "status": "waiting", "message": "Waiting for SMS provider"}	t	2025-12-08 11:23:07.834
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Client" (id, name, "createdAt", "phoneNumber", "updatedAt") FROM stdin;
6	\N	2025-10-11 09:43:54.648	+998998137861	2025-10-11 09:43:54.648
18	\N	2025-12-09 15:27:16.691	+998998901234	2025-12-09 15:27:16.691
19	\N	2025-12-12 10:48:32.494	+998003332211	2025-12-12 10:48:32.494
20	\N	2025-12-15 15:18:00.42	deleted_1765811984780_gvq6rc	2025-12-15 15:19:44.781
21	\N	2025-12-15 15:20:19.481	deleted_1765812019501_aw459g	2025-12-15 15:20:19.502
17	\N	2025-12-08 06:21:54.331	deleted_1765813510910_73kalq	2025-12-15 15:45:10.91
22	\N	2025-12-15 15:45:17.95	deleted_1765813548981_ykleun	2025-12-15 15:45:48.982
23	Ahmad 33	2025-12-15 15:53:06.72	+998334007551	2025-12-15 15:53:06.72
24	\N	2025-12-16 05:02:00.031	deleted_1765862075574_d8o6uh	2025-12-16 05:14:35.576
25	Khayat	2025-12-16 19:04:45.132	+998976050804	2025-12-16 19:04:45.132
26	Ranjeet kumar	2025-12-17 05:57:49.942	+998651607368	2025-12-17 05:57:49.942
27	1	2025-12-17 17:52:05.925	+998003332222	2025-12-17 17:52:05.925
28	test	2025-12-18 15:15:02.163	+998003332233	2025-12-18 15:15:02.163
29	Akhmadjon Buranov	2025-12-20 06:57:53.173	+998337017755	2025-12-20 06:57:53.173
30	KEmT	2025-12-21 12:48:01.909	+998	2025-12-21 12:48:01.909
31	Дима 	2025-12-22 08:42:35.693	+998795859429	2025-12-22 08:42:35.693
32	\N	2025-12-25 13:47:48.987	+998998998137	2025-12-25 13:47:48.987
33	\N	2025-12-30 09:35:38.543	+998900000004	2025-12-30 09:35:38.543
34	Soni sahu	2026-01-07 02:06:05.738	+998780391543	2026-01-07 02:06:05.738
\.


--
-- Data for Name: ManualActivationRequest; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."ManualActivationRequest" (id, "voucherId", status, key, "operatorId", "createdAt", "updatedAt") FROM stdin;
5	517	COMPLETED	K1APT-K1APT-K1APT-K1APT-K1APT	9	2025-12-08 11:21:16.681	2025-12-08 11:22:24.931
\.


--
-- Data for Name: Merchant; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Merchant" (id, username, status, "legalInfo", balance) FROM stdin;
7	tcm-corner1	active	1	8903300
8	tcm-corner2	active		4255050
\.


--
-- Data for Name: MerchantPayment; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."MerchantPayment" (id, "merchantId", amount, comment, "createdAt", "balanceAfter", "balanceBefore") FROM stdin;
\.


--
-- Data for Name: MerchantProductLink; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."MerchantProductLink" (id, "merchantId", "productId", token, "isActive", "createdAt") FROM stdin;
1	7	43	ac827277-4654-4c55-98c2-9bca01beefb3	t	2025-12-24 19:44:17.132
2	7	44	3ce45bf4-30c5-4883-bd2c-7878db65b17e	t	2025-12-25 06:29:56.449
3	8	44	8f63d0bc-e669-4e2d-b19e-ab26b6bc6580	t	2025-12-25 06:54:22.863
4	8	43	062730ee-c706-4e0e-be33-c22d6c1674ed	t	2025-12-25 07:25:59.319
5	7	45	ae864807-67e8-476e-ae1b-06c4e8e1a1c9	t	2025-12-25 13:11:06.247
6	8	45	b616d89d-abd7-446a-9114-f3b1dc77999b	t	2025-12-25 13:30:03.889
\.


--
-- Data for Name: OnlineVoucher; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."OnlineVoucher" (id, "clientId", "voucherId", "assignedAt") FROM stdin;
27	17	527	2025-12-09 13:43:59.43
28	19	528	2025-12-12 10:56:52.389
29	27	529	2025-12-17 17:52:33.658
30	28	530	2025-12-18 15:15:25.663
31	6	507	2025-12-25 03:26:28.458
32	29	532	2025-12-25 06:49:50.672
33	23	533	2025-12-25 06:55:02.172
34	6	534	2025-12-25 07:14:54.049
35	23	508	2025-12-25 07:26:28.876
36	23	509	2025-12-25 08:48:50.327
37	6	554	2025-12-25 13:11:19.12
38	23	555	2025-12-25 13:11:46.345
39	23	556	2025-12-25 13:15:28.267
40	29	557	2025-12-25 13:16:13.789
41	32	558	2025-12-25 13:47:48.988
42	6	559	2025-12-30 07:31:26.366
43	33	510	2025-12-30 09:35:38.546
44	32	560	2026-01-09 11:26:08.033
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Product" (id, name, price, "vendorId", status, "merchantCommissionPercent", "vendorCommissionPercent", "rokkySku", "storeId", "receiptTemplate") FROM stdin;
37	PUBG Mobile 8100 UC	1344000	11	on	4	10	\N	\N	\N
39	PUBG Mobile 1800 UC	345000	11	on	5	10	\N	\N	\N
41	PUBG Mobile 325 UC	80000	11	on	10	10	\N	\N	\N
38	PUBG Mobile 3850 UC	700000	11	on	5	10	\N	\N	\N
40	PUBG Mobile 660 UC	160000	11	on	10	10	\N	\N	\N
28	Roblox Gift Card 10000 Robux	1984000	12	on	10	10	\N	4	\N
29	Roblox Gift Card 4500 Robux	1024000	12	on	10	10	\N	4	\N
30	Roblox Gift Card 2000 Robux	525000	12	on	10	10	\N	4	\N
31	Roblox Gift Card 1500 Robux	420000	12	on	10	10	\N	4	\N
32	Roblox Gift Card 1000 Robux	270000	12	on	10	10	\N	4	\N
34	Roblox Gift Card 400 Robux	230000	12	on	10	10	\N	4	\N
33	Roblox Gift Card 800 Robux	230000	12	off	10	10	\N	4	\N
35	Roblox Gift Card 200 Robux	128000	12	on	10	10	\N	4	\N
36	Roblox Gift Card 100 Robux	90000	12	on	10	10	\N	4	\N
43	Microsoft 365 для семьи	1290000	13	on	4	10	\N	5	\N
42	Microsoft 365 персональный	1150000	13	on	3	10	\N	5	\N
44	Абонемент Fitness на 1 месяц	900000	14	on	2	12	\N	\N	\N
45	Test Product	5000	14	on	5	25	\N	\N	\N
\.


--
-- Data for Name: QrPaymentAttempt; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."QrPaymentAttempt" (id, "linkId", "phoneNumber", amount, "paymentMethod", status, "externalPaymentId", "createdAt", "expiresAt", "paidAt", "saleId", "voucherValue", "receiptPath", "cancelReason", "cancelTime") FROM stdin;
1	1	+998998137861	1290000	payme	PAID	\N	2025-12-25 03:26:28.402	2025-12-25 03:28:28.4	2025-12-25 03:26:28.474	105	MSFNFQALJ	\N	\N	\N
2	2	+998337017755	900000	click	PAID	\N	2025-12-25 06:49:50.657	2025-12-25 06:51:50.656	2025-12-25 06:49:50.68	106	FRKHSOKZ	\N	\N	\N
3	3	+998334007551	900000	click	PAID	\N	2025-12-25 06:55:02.16	2025-12-25 06:57:02.159	2025-12-25 06:55:02.179	107	FRT7K0LM	\N	\N	\N
4	3	+998998137861	900000	payme	PAID	\N	2025-12-25 07:14:54.036	2025-12-25 07:16:54.035	2025-12-25 07:14:54.055	108	FR2Q4WS7	qr-receipt-4.pdf	\N	\N
5	4	+998334007551	1290000	click	PAID	\N	2025-12-25 07:26:28.868	2025-12-25 07:28:28.867	2025-12-25 07:26:28.88	109	MSFNEF8B8	qr-receipt-5.pdf	\N	\N
6	4	+998334007551	1290000	click	PAID	\N	2025-12-25 08:48:50.293	2025-12-25 08:50:50.292	2025-12-25 08:48:50.305	110	MSFT9G2F2	receipt-qr-6-2025-12-25T08-48-50-305Z.pdf	\N	\N
7	5	+998998137861	5000	click	PAID	\N	2025-12-25 13:11:19.094	2025-12-25 13:13:19.093	2025-12-25 13:11:19.102	111	55E4C4QQ	receipt-qr-7-2025-12-25T13-11-19-102Z.pdf	\N	\N
8	5	+998334007551	5000	payme	PAID	\N	2025-12-25 13:11:46.338	2025-12-25 13:13:46.337	2025-12-25 13:11:46.34	112	55HS95WU	receipt-qr-8-2025-12-25T13-11-46-340Z.pdf	\N	\N
9	5	+998334007551	5000	payme	PAID	\N	2025-12-25 13:15:28.258	2025-12-25 13:17:28.258	2025-12-25 13:15:28.261	113	5519WLE5	receipt-qr-9-2025-12-25T13-15-28-261Z.pdf	\N	\N
10	5	+998337017755	5000	click	PAID	\N	2025-12-25 13:16:13.782	2025-12-25 13:18:13.782	2025-12-25 13:16:13.784	114	550WLTB1	receipt-qr-10-2025-12-25T13-16-13-784Z.pdf	\N	\N
11	5	+998998998137	5000	click	PENDING	\N	2025-12-25 13:19:23.55	2025-12-25 13:34:23.549	\N	\N	\N	\N	\N	\N
13	6	+998334007551	5000	payme	PENDING	\N	2025-12-25 13:45:49.483	2025-12-25 14:00:49.483	\N	\N	\N	\N	\N	\N
12	6	+998998998137	5000	payme	PAID	test-1766670464	2025-12-25 13:30:16.385	2025-12-25 13:45:16.384	2025-12-25 13:47:48.976	115	55UZYE68	receipt-qr-12-2025-12-25T13-47-48-976Z.pdf	\N	\N
14	6	+998998137861	5000	click	PENDING	\N	2025-12-25 14:17:29.321	2025-12-25 14:32:29.32	\N	\N	\N	\N	\N	\N
15	6	+998998137861	5000	payme	PENDING	\N	2025-12-26 12:04:55.18	2025-12-26 12:19:55.179	\N	\N	\N	\N	\N	\N
16	6	+998998137861	5000	click	PENDING	\N	2025-12-26 12:05:56.484	2025-12-26 12:20:56.484	\N	\N	\N	\N	\N	\N
17	6	+998334007551	5000	payme	PENDING	\N	2025-12-26 12:13:00.129	2025-12-26 12:28:00.129	\N	\N	\N	\N	\N	\N
18	5	+998998998137	5000	payme	PROCESSING	694e7fdb20cfb2025b9fad71	2025-12-26 12:29:45.769	2025-12-26 12:44:45.768	\N	\N	\N	\N	\N	\N
19	6	+998998998137	5000	payme	PROCESSING	694e83f920cfb2025b9fad76	2025-12-26 12:47:39.479	2025-12-26 13:02:39.478	\N	\N	\N	\N	\N	\N
20	6	+998998998137	5000	payme	PROCESSING	694e84cd20cfb2025b9fad77	2025-12-26 12:51:12.419	2025-12-26 13:06:12.418	\N	\N	\N	\N	\N	\N
24	1	+998900000001	10000	\N	PENDING	\N	2025-12-26 13:08:03.225	2025-12-27 13:08:03.225	\N	\N	\N	\N	\N	\N
25	1	+998900000002	25000	\N	PENDING	\N	2025-12-26 13:08:03.225	2025-12-27 13:08:03.225	\N	\N	\N	\N	\N	\N
28	6	+998998137861	5000	click	PAID	3441252274	2025-12-30 07:30:42.473	2025-12-30 07:45:42.472	2025-12-30 07:31:26.345	116	55ED3P3Q	receipt-qr-28-2025-12-30T07-31-26-345Z.pdf	\N	\N
26	1	+998900000003	15000	\N	PROCESSING	69539c5e20cfb2025b9fb6da	2025-12-26 13:52:45.113	2025-12-27 13:52:45.113	\N	\N	\N	\N	\N	\N
27	1	+998900000004	50000	\N	FAILED	69539c8720cfb2025b9fb6e4	2025-12-26 13:52:45.113	2025-12-27 13:52:45.113	2025-12-30 09:35:38.487	117	MSFWBJLJ4	receipt-qr-27-2025-12-30T09-35-38-487Z.pdf	5	2025-12-30 09:35:45.551
21	6	+998998998137	5000	payme	FAILED	6960e5c020cfb2025b9fd189	2025-12-26 12:52:27.063	2025-12-26 13:07:27.062	2026-01-09 11:26:07.967	118	553GVTZE	receipt-qr-21-2026-01-09T11-26-07-967Z.pdf	5	2026-01-09 11:26:13.933
22	6	+998998998137	5000	payme	FAILED	6961eeb520cfb2025b9fd2fd	2025-12-26 12:53:07.67	2025-12-26 13:08:07.669	\N	\N	\N	\N	3	2026-01-10 06:16:29.861
23	6	+998998998137	5000	payme	PROCESSING	6961ef1420cfb2025b9fd304	2025-12-26 12:58:42.722	2025-12-26 13:13:42.721	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."RefreshToken" (id, "userId", "clientId", role, token, "expiresAt", "createdAt", "updatedAt") FROM stdin;
88	\N	28	client	7db560b3aee4dd140dedc7b15258812ab6ccf8fed677c0209f89b6b461af817885e724bb13b29373	2026-01-20 13:02:16.186	2025-12-21 13:00:47.3	2025-12-21 13:02:16.188
34	\N	\N	client	d9a9a5a10bd09d5300ffac7b8d286e52fa04f547d0b4e71c3743cfd062b3e0bb2a395083e01927fa	2025-12-12 18:59:45.155	2025-11-12 18:58:23.732	2025-11-29 07:18:38.609
92	\N	25	client	29a9645b270f90e8f9c70a7b5f64f7075b81a4310e48789b1d0536aab5d7d17be7f487b6e66ba88e	2026-02-02 17:39:29.981	2025-12-25 16:03:16.917	2026-01-03 17:39:29.997
91	\N	23	client	0e252b33d14822e3c1782fc3135b4c6c71035e5b2a03017f19ba5cc8a7e6df26d897d97b0fcd0032	2026-02-16 15:52:29.433	2025-12-25 07:27:08.133	2026-01-17 15:52:29.442
71	\N	6	client	3d73a83fee4eed9afdb15db58be4623b71613fc6c2719c89a216418afc22f33e21790fe5064e10c8	2026-02-19 06:28:09.696	2025-12-15 13:56:44.781	2026-01-20 06:28:09.715
\.


--
-- Data for Name: RokkyApiLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."RokkyApiLog" (id, method, sku, "referenceId", "requestData", "responseData", "statusCode", success, "errorMessage", duration, "createdAt") FROM stdin;
\.


--
-- Data for Name: RokkyOrder; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."RokkyOrder" (id, "rokkyOrderId", "voucherId", status, key, "createdAt", "updatedAt", "errorMessage", sku) FROM stdin;
\.


--
-- Data for Name: RokkySku; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."RokkySku" (id, sku, name, description, category, "costPrice", "retailPrice", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Sale" (id, "voucherValue", price, "productId", "productName", "merchantUsername", date, "receiptPath", status, "saleType", "customerPhone") FROM stdin;
99	MSPW40N3D	1150000	42	Microsoft 365 персональный	tcm-corner1	2025-12-08 12:25:34.868	receipts/receipt-tcm-corner1-2025-12-08T12-25-34-853Z.pdf	COMPLETED	OFFLINE	\N
100	FIT146T	900000	44	Абонемент Fitness на 1 месяц	tcm-corner1	2025-12-09 13:43:59.428	receipts/receipt-tcm-corner1-2025-12-09T13-43-59-409Z.pdf	COMPLETED	ONLINE	+998334007551
101	123FIT146T1	900000	44	Абонемент Fitness на 1 месяц	tcm-corner1	2025-12-12 10:56:52.388	receipts/receipt-tcm-corner1-2025-12-12T10-56-52-378Z.pdf	COMPLETED	ONLINE	+998003332211
102	FRO0K8R5	900000	44	Абонемент Fitness на 1 месяц	tcm-corner1	2025-12-17 17:52:33.655	receipts/receipt-tcm-corner1-2025-12-17T17-52-33-638Z.pdf	COMPLETED	ONLINE	+998003332222
103	FR2FG5J6	900000	44	Абонемент Fitness на 1 месяц	tcm-corner1	2025-12-18 15:15:25.661	receipts/receipt-tcm-corner1-2025-12-18T15-15-25-628Z.pdf	COMPLETED	ONLINE	+998003332233
104	FR2BR4M4	900000	44	Абонемент Fitness на 1 месяц	tcm-corner1	2025-12-20 06:05:51.642	receipts/receipt-tcm-corner1-2025-12-20T06-05-51-621Z.pdf	COMPLETED	OFFLINE	\N
105	MSFNFQALJ	1290000	43	Microsoft 365 для семьи	tcm-corner1	2025-12-25 03:26:28.449	\N	COMPLETED	ONLINE	+998998137861
106	FRKHSOKZ	900000	44	Абонемент Fitness на 1 месяц	tcm-corner1	2025-12-25 06:49:50.67	\N	COMPLETED	ONLINE	+998337017755
107	FRT7K0LM	900000	44	Абонемент Fitness на 1 месяц	tcm-corner2	2025-12-25 06:55:02.17	\N	COMPLETED	ONLINE	+998334007551
108	FR2Q4WS7	900000	44	Абонемент Fitness на 1 месяц	tcm-corner2	2025-12-25 07:14:54.047	\N	COMPLETED	ONLINE	+998998137861
109	MSFNEF8B8	1290000	43	Microsoft 365 для семьи	tcm-corner2	2025-12-25 07:26:28.874	\N	COMPLETED	ONLINE	+998334007551
110	MSFT9G2F2	1290000	43	Microsoft 365 для семьи	tcm-corner2	2025-12-25 08:48:50.322	receipts/receipt-qr-6-2025-12-25T08-48-50-305Z.pdf	COMPLETED	ONLINE	+998334007551
111	55E4C4QQ	5000	45	Test Product	tcm-corner1	2025-12-25 13:11:19.115	receipts/receipt-qr-7-2025-12-25T13-11-19-102Z.pdf	COMPLETED	ONLINE	+998998137861
112	55HS95WU	5000	45	Test Product	tcm-corner1	2025-12-25 13:11:46.344	receipts/receipt-qr-8-2025-12-25T13-11-46-340Z.pdf	COMPLETED	ONLINE	+998334007551
113	5519WLE5	5000	45	Test Product	tcm-corner1	2025-12-25 13:15:28.265	receipts/receipt-qr-9-2025-12-25T13-15-28-261Z.pdf	COMPLETED	ONLINE	+998334007551
114	550WLTB1	5000	45	Test Product	tcm-corner1	2025-12-25 13:16:13.787	receipts/receipt-qr-10-2025-12-25T13-16-13-784Z.pdf	COMPLETED	ONLINE	+998337017755
115	55UZYE68	5000	45	Test Product	tcm-corner2	2025-12-25 13:47:48.985	receipts/receipt-qr-12-2025-12-25T13-47-48-976Z.pdf	COMPLETED	ONLINE	+998998998137
116	55ED3P3Q	5000	45	Test Product	tcm-corner2	2025-12-30 07:31:26.362	receipts/receipt-qr-28-2025-12-30T07-31-26-345Z.pdf	COMPLETED	ONLINE	+998998137861
117	MSFWBJLJ4	1290000	43	Microsoft 365 для семьи	tcm-corner1	2025-12-30 09:35:38.533	receipts/receipt-qr-27-2025-12-30T09-35-38-487Z.pdf	COMPLETED	ONLINE	+998900000004
118	553GVTZE	5000	45	Test Product	tcm-corner2	2026-01-09 11:26:08.015	receipts/receipt-qr-21-2026-01-09T11-26-07-967Z.pdf	COMPLETED	ONLINE	+998998998137
\.


--
-- Data for Name: Store; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Store" (id, slug, name, "isActive", "backgroundColor", "logoUrl", "themeColor", "activationSmsTemplate") FROM stdin;
4	roblox	Roblox	t	#F8FAFC	\N	#4F46E5	Vash vaucher aktivirovan | Sizning vaucheringiz faollashtirildi https://namo.uz/link
5	microsoft	Microsoft	t	#ffffff	/uploads/logo-1765192774853-572135718.png	#3884ff	Vash vaucher aktivirovan | Sizning vaucheringiz faollashtirildi https://namo.uz/microsoft
\.


--
-- Data for Name: StoreTelegramBot; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."StoreTelegramBot" (id, "storeId", "telegramBotId") FROM stdin;
3	5	2
\.


--
-- Data for Name: TelegramBot; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."TelegramBot" (id, name, token, "authorizedUsers", "isActive", "createdAt", "updatedAt") FROM stdin;
2	POSA Notifications	8576752244:AAFKmpG_uzqoRO5YkjBMatKYqdqtR56Wxy0	["246590221"]	t	2025-12-06 14:40:09.254	2025-12-08 11:18:47.703
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."User" (id, username, password, role, note, "vendorId") FROM stdin;
9	office_admin1	$2b$10$1gZNkoBqRvh0Cxp4Fa0E2.zxFk9BJHYyxZ5iEsSVaza.t61ULEWNm	admin	\N	\N
14	tcm-corner1	$2b$10$YEloqdmzuASHuGz74455EOpXHzpUxY9mI9xtSrPD5NV76rxaGI4iy	merchant	\N	\N
21	finance	$2b$10$Ud.7HVS6l8LKk4kdj3MK5eUwZt/XMaLppyZfJi0W.RghRvSU1R1ju	financial_mgr	\N	\N
23	sales	$2b$10$4Ys0DZhenttpmfDAgd0mpu0gXz5JNldsuSF1GAGOjapXMXFafSC1W	support_agent	\N	\N
22	content	$2b$10$PVeswM3spu.2AhzYciSr2.rhu40HUxctbjQViY/sD5HeeIzuIpAvO	content_mgr	\N	\N
\.


--
-- Data for Name: Vendor; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."Vendor" (id, name, category, description, "productType", "receiptTemplate", "defaultCommissionPercent", balance) FROM stdin;
12	ROBLOX GIFT CARD	Gorgeous Partners	Gorgeous Partners	ROKKY	{"version":1,"meta":{"title":"ROBLOX GIFT CARD Receipt"},"elements":[{"id":"heading","type":"heading","text":"🧾 Чек продажи","align":"center","showPrice":true,"showQty":true},{"id":"divider-1","type":"divider","align":"left","style":"dashed","showPrice":true,"showQty":true},{"id":"merchant-info","type":"text","text":"Продавец: {{merchant}}\\nВендор: {{vendorName}}\\nДата: {{date}}","align":"left","showPrice":true,"showQty":true},{"id":"items-table","type":"line-items","align":"left","showPrice":true,"showQty":true},{"id":"total","type":"total","align":"left","label":"Итого","showPrice":true,"showQty":true},{"id":"voucher-block","type":"text","text":"Ваучер: {{voucherMasked}}","align":"left","showPrice":true,"showQty":true},{"id":"qr-section","type":"qr","align":"left","showPrice":true,"showQty":true,"caption":"Сканируйте для активации"},{"id":"footer","type":"text","text":"Спасибо за покупку! Возврат невозможен.","align":"center","showPrice":true,"showQty":true}]}	20	0
11	PUBG Mobile	Gorgeous Partners	Gorgeous Partners	ROKKY	{"version":1,"meta":{"title":"PUBG Mobile Receipt"},"elements":[{"id":"heading","type":"heading","text":"🧾 Чек продажи","align":"center","showPrice":true,"showQty":true},{"id":"divider-1","type":"divider","align":"left","style":"dashed","showPrice":true,"showQty":true},{"id":"merchant-info","type":"text","text":"Продавец: {{merchant}}\\nВендор: {{vendorName}}\\nДата: {{date}}","align":"left","showPrice":true,"showQty":true},{"id":"items-table","type":"line-items","align":"left","showPrice":true,"showQty":true},{"id":"total","type":"total","align":"left","label":"Итого","showPrice":true,"showQty":true},{"id":"voucher-block","type":"text","text":"Ваучер: {{voucherMasked}}","align":"left","showPrice":true,"showQty":true},{"id":"qr-section","type":"qr","align":"left","showPrice":true,"showQty":true,"caption":"Сканируйте для активации"},{"id":"footer","type":"text","text":"Спасибо за покупку! Возврат невозможен.","align":"center","showPrice":true,"showQty":true}]}	20	0
13	Microsoft	Gorgeous Partners	Gorgeous Partners	MANUAL	{"version":1,"meta":{"title":"Microsoft Receipt"},"elements":[{"id":"heading","type":"heading","text":"🧾 Чек продажи","align":"center"},{"id":"divider-1","type":"divider","style":"dashed"},{"id":"merchant-info","type":"text","text":"Продавец: {{merchant}}\\nВендор: {{vendorName}}\\nДата: {{date}}","align":"left"},{"id":"items-table","type":"line-items","showPrice":true,"showQty":true},{"id":"total","type":"total","label":"Итого"},{"id":"voucher-block","type":"text","text":"Ваучер: {{voucherMasked}}","align":"left"},{"id":"qr-section","type":"qr","caption":"Сканируйте для активации"},{"id":"footer","type":"text","text":"Спасибо за покупку! Возврат невозможен.","align":"center"}]}	10	5679000
14	Fitness	Fitness	Fitness	VOUCHER	{"version":1,"meta":{"title":"Fitness Receipt"},"elements":[{"id":"heading","type":"heading","text":"🧾 Чек продажи","align":"center"},{"id":"divider-1","type":"divider","style":"dashed"},{"id":"merchant-info","type":"text","text":"Продавец: {{merchant}}\\nВендор: {{vendorName}}\\nДата: {{date}}","align":"left"},{"id":"items-table","type":"line-items","showPrice":true,"showQty":true},{"id":"total","type":"total","label":"Итого"},{"id":"voucher-block","type":"text","text":"Ваучер: {{voucherMasked}}","align":"left"},{"id":"qr-section","type":"qr","caption":"Сканируйте для активации"},{"id":"footer","type":"text","text":"Спасибо за покупку! Возврат невозможен.","align":"center"}]}	20	6362250
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
511	MSFBENTW5	active	43	Microsoft 365 для семьи	Vendor
512	MSFVVBS36	active	43	Microsoft 365 для семьи	Vendor
513	MSF516QUX	active	43	Microsoft 365 для семьи	Vendor
514	MSF4QU9YG	active	43	Microsoft 365 для семьи	Vendor
515	MSF36JLHG	active	43	Microsoft 365 для семьи	Vendor
516	MSFO3QY62	active	43	Microsoft 365 для семьи	Vendor
519	MSPAOFZJT	active	42	Microsoft 365 персональный	Vendor
520	MSPTX5LDC	active	42	Microsoft 365 персональный	Vendor
521	MSPFUF260	active	42	Microsoft 365 персональный	Vendor
522	MSP892D00	active	42	Microsoft 365 персональный	Vendor
523	MSPJG6RPU	active	42	Microsoft 365 персональный	Vendor
524	MSP3D2A7A	active	42	Microsoft 365 персональный	Vendor
525	MSPFB4R28	active	42	Microsoft 365 персональный	Vendor
526	MSPOMUS1Q	active	42	Microsoft 365 персональный	Vendor
517	MSPHYNF4B	activated	42	Microsoft 365 персональный	Vendor
518	MSPW40N3D	sold	42	Microsoft 365 персональный	Vendor
527	FIT146T	sold	44	Абонемент Fitness на 1 месяц	Vendor
528	123FIT146T1	sold	44	Абонемент Fitness на 1 месяц	Vendor
535	FRAMMPG5	active	44	Абонемент Fitness на 1 месяц	Vendor
536	FRJO616A	active	44	Абонемент Fitness на 1 месяц	Vendor
537	FRZ3P6JB	active	44	Абонемент Fitness на 1 месяц	Vendor
538	FRCEDXX8	active	44	Абонемент Fitness на 1 месяц	Vendor
539	FR331O3K	active	44	Абонемент Fitness на 1 месяц	Vendor
540	FRA7LJ4K	active	44	Абонемент Fitness на 1 месяц	Vendor
541	FR2TW0GW	active	44	Абонемент Fitness на 1 месяц	Vendor
542	FRQV927S	active	44	Абонемент Fitness на 1 месяц	Vendor
543	FRHF33NL	active	44	Абонемент Fitness на 1 месяц	Vendor
544	FRUBCU7D	active	44	Абонемент Fitness на 1 месяц	Vendor
545	FRHLJ3YN	active	44	Абонемент Fitness на 1 месяц	Vendor
546	FRL8Q19W	active	44	Абонемент Fitness на 1 месяц	Vendor
547	FRR6JL3P	active	44	Абонемент Fitness на 1 месяц	Vendor
548	FRGZV39G	active	44	Абонемент Fitness на 1 месяц	Vendor
549	FR2YOJTP	active	44	Абонемент Fitness на 1 месяц	Vendor
550	FRTQQOO3	active	44	Абонемент Fitness на 1 месяц	Vendor
551	FR66O8MT	active	44	Абонемент Fitness на 1 месяц	Vendor
552	FRJWEJVU	active	44	Абонемент Fitness на 1 месяц	Vendor
553	FR8DEE4Z	active	44	Абонемент Fitness на 1 месяц	Vendor
529	FRO0K8R5	sold	44	Абонемент Fitness на 1 месяц	Vendor
530	FR2FG5J6	sold	44	Абонемент Fitness на 1 месяц	Vendor
531	FR2BR4M4	sold	44	Абонемент Fitness на 1 месяц	Vendor
507	MSFNFQALJ	sold	43	Microsoft 365 для семьи	Vendor
532	FRKHSOKZ	sold	44	Абонемент Fitness на 1 месяц	Vendor
533	FRT7K0LM	sold	44	Абонемент Fitness на 1 месяц	Vendor
534	FR2Q4WS7	sold	44	Абонемент Fitness на 1 месяц	Vendor
508	MSFNEF8B8	sold	43	Microsoft 365 для семьи	Vendor
509	MSFT9G2F2	sold	43	Microsoft 365 для семьи	Vendor
561	55JZN4AD	active	45	Test Product	Vendor
562	5545CDHH	active	45	Test Product	Vendor
563	55CX3A19	active	45	Test Product	Vendor
564	55NT7OM5	active	45	Test Product	Vendor
565	55YKKV9Z	active	45	Test Product	Vendor
566	55A63XC8	active	45	Test Product	Vendor
567	55NZFVLQ	active	45	Test Product	Vendor
568	55DFPSGP	active	45	Test Product	Vendor
569	55QLSU1H	active	45	Test Product	Vendor
570	55D9ZD42	active	45	Test Product	Vendor
571	55Y7RU5N	active	45	Test Product	Vendor
572	55W7QY23	active	45	Test Product	Vendor
573	55474E8Z	active	45	Test Product	Vendor
574	55HLG0WG	active	45	Test Product	Vendor
575	55SFPRXW	active	45	Test Product	Vendor
576	55L6VOY7	active	45	Test Product	Vendor
577	55Y8REAP	active	45	Test Product	Vendor
578	552MRWWW	active	45	Test Product	Vendor
579	55RZ7GJ2	active	45	Test Product	Vendor
580	555WHND2	active	45	Test Product	Vendor
581	55FYAVTZ	active	45	Test Product	Vendor
582	5515CY9G	active	45	Test Product	Vendor
583	55QMC2LZ	active	45	Test Product	Vendor
584	55FY1Y1U	active	45	Test Product	Vendor
585	5576XG2U	active	45	Test Product	Vendor
586	5578GZP8	active	45	Test Product	Vendor
587	55FMQ6G3	active	45	Test Product	Vendor
588	55DWGWNL	active	45	Test Product	Vendor
589	55JATNQ9	active	45	Test Product	Vendor
590	5548L4OE	active	45	Test Product	Vendor
591	55EQDB0Q	active	45	Test Product	Vendor
592	55ZC2F90	active	45	Test Product	Vendor
593	55JS6ET3	active	45	Test Product	Vendor
594	557S9SF9	active	45	Test Product	Vendor
595	55H36QD7	active	45	Test Product	Vendor
596	55PQ7JTX	active	45	Test Product	Vendor
555	55HS95WU	sold	45	Test Product	Vendor
556	5519WLE5	sold	45	Test Product	Vendor
557	550WLTB1	sold	45	Test Product	Vendor
558	55UZYE68	sold	45	Test Product	Vendor
559	55ED3P3Q	sold	45	Test Product	Vendor
510	MSFWBJLJ4	sold	43	Microsoft 365 для семьи	Vendor
560	553GVTZE	sold	45	Test Product	Vendor
597	55R8RQXH	active	45	Test Product	Vendor
600	55YXNCKV	active	45	Test Product	Vendor
604	55A62GL1	active	45	Test Product	Vendor
606	559VAHB5	active	45	Test Product	Vendor
607	55E8BQJT	active	45	Test Product	Vendor
554	55E4C4QQ	sold	45	Test Product	Vendor
598	55LG1EXL	active	45	Test Product	Vendor
599	55MPDP64	active	45	Test Product	Vendor
601	5553CTVD	active	45	Test Product	Vendor
602	554CK15J	active	45	Test Product	Vendor
603	55JA5TGW	active	45	Test Product	Vendor
605	55FDLFMQ	active	45	Test Product	Vendor
608	55S944S7	active	45	Test Product	Vendor
\.


--
-- Data for Name: VoucherActivation; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherActivation" (id, "voucherId", "activatedBy", "vendorId", "activatedAt", "clientId") FROM stdin;
\.


--
-- Data for Name: VoucherSmsLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherSmsLog" (id, "voucherId", "phoneNumber", message, "requestId", status, "statusDate", "createdAt", response) FROM stdin;
19	527	+998334007551	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	455f1763-3f01-4d96-95c6-297ff3dd5e21	delivered	2025-12-09 13:43:59.912	2025-12-09 13:43:59.914	{"data": {"id": "455f1763-3f01-4d96-95c6-297ff3dd5e21", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "455f1763-3f01-4d96-95c6-297ff3dd5e21", "success": true}
20	528	+998003332211	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	unknown	rejected	2025-12-12 10:56:53.746	2025-12-12 10:56:53.747	{"error": "SMSC not found", "success": false}
21	529	+998003332222	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	unknown	rejected	2025-12-17 17:52:34.027	2025-12-17 17:52:34.028	{"error": "SMSC not found", "success": false}
22	530	+998003332233	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	unknown	rejected	2025-12-18 15:15:26.392	2025-12-18 15:15:26.393	{"error": "SMSC not found", "success": false}
23	509	+998334007551	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	4df43094-faa6-4f6b-86e1-00bfbb657bfc	delivered	2025-12-25 08:48:52.017	2025-12-25 08:48:52.019	{"data": {"id": "4df43094-faa6-4f6b-86e1-00bfbb657bfc", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "4df43094-faa6-4f6b-86e1-00bfbb657bfc", "success": true}
24	554	+998998137861	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	a16a4a2b-78ae-4c66-a42f-78fb0ba20f90	delivered	2025-12-25 13:11:19.691	2025-12-25 13:11:19.693	{"data": {"id": "a16a4a2b-78ae-4c66-a42f-78fb0ba20f90", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "a16a4a2b-78ae-4c66-a42f-78fb0ba20f90", "success": true}
25	555	+998334007551	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	8f5109be-2366-4eec-92f7-f1847d01f66c	delivered	2025-12-25 13:11:46.817	2025-12-25 13:11:46.818	{"data": {"id": "8f5109be-2366-4eec-92f7-f1847d01f66c", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "8f5109be-2366-4eec-92f7-f1847d01f66c", "success": true}
26	556	+998334007551	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	c7c3bea6-e946-4039-a6ff-3a86ca050f5b	delivered	2025-12-25 13:15:28.695	2025-12-25 13:15:28.697	{"data": {"id": "c7c3bea6-e946-4039-a6ff-3a86ca050f5b", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "c7c3bea6-e946-4039-a6ff-3a86ca050f5b", "success": true}
27	557	+998337017755	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	fcf768ec-30c1-4189-8b71-bb987c324d16	delivered	2025-12-25 13:16:14.218	2025-12-25 13:16:14.22	{"data": {"id": "fcf768ec-30c1-4189-8b71-bb987c324d16", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "fcf768ec-30c1-4189-8b71-bb987c324d16", "success": true}
28	558	+998998998137	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	b2a812ae-dcf6-41de-acc8-565e63cc35ca	delivered	2025-12-25 13:47:50.537	2025-12-25 13:47:50.538	{"data": {"id": "b2a812ae-dcf6-41de-acc8-565e63cc35ca", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "b2a812ae-dcf6-41de-acc8-565e63cc35ca", "success": true}
29	559	+998998137861	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	663e86fc-f3f8-482e-95c8-b32c8ad32408	delivered	2025-12-30 07:31:27.113	2025-12-30 07:31:27.114	{"data": {"id": "663e86fc-f3f8-482e-95c8-b32c8ad32408", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "663e86fc-f3f8-482e-95c8-b32c8ad32408", "success": true}
30	510	+998900000004	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	f02d8219-84ca-488c-9b5a-3566048c48b4	delivered	2025-12-30 09:35:39.361	2025-12-30 09:35:39.362	{"data": {"id": "f02d8219-84ca-488c-9b5a-3566048c48b4", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "f02d8219-84ca-488c-9b5a-3566048c48b4", "success": true}
31	560	+998998998137	Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz	00694e73-510f-4dc2-ac87-579bdea7e896	delivered	2026-01-09 11:26:09.668	2026-01-09 11:26:09.67	{"data": {"id": "00694e73-510f-4dc2-ac87-579bdea7e896", "status": "waiting", "message": "Waiting for SMS provider"}, "smsId": "00694e73-510f-4dc2-ac87-579bdea7e896", "success": true}
\.


--
-- Data for Name: VoucherTransaction; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherTransaction" (id, "voucherValue", "merchantId", "vendorId", "productId", "productName", price, "merchantDebt", "adminDebt", status, "createdAt", "vendorDebt") FROM stdin;
80	MSPW40N3D	7	13	42	Microsoft 365 персональный	1150000	1115500	115000	PENDING	2025-12-08 12:25:34.87	1035000
81	FIT146T	7	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-09 13:43:59.441	792000
82	123FIT146T1	7	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-12 10:56:52.393	792000
83	FRO0K8R5	7	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-17 17:52:33.666	792000
84	FR2FG5J6	7	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-18 15:15:25.666	792000
85	FR2BR4M4	7	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-20 06:05:51.653	792000
86	MSFNFQALJ	7	13	43	Microsoft 365 для семьи	1290000	1238400	129000	PENDING	2025-12-25 03:26:28.466	1161000
87	FRKHSOKZ	7	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-25 06:49:50.676	792000
88	FRT7K0LM	8	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-25 06:55:02.174	792000
89	FR2Q4WS7	8	14	44	Абонемент Fitness на 1 месяц	900000	882000	108000	PENDING	2025-12-25 07:14:54.052	792000
90	MSFNEF8B8	8	13	43	Microsoft 365 для семьи	1290000	1238400	129000	PENDING	2025-12-25 07:26:28.878	1161000
91	MSFT9G2F2	8	13	43	Microsoft 365 для семьи	1290000	1238400	129000	PENDING	2025-12-25 08:48:50.331	1161000
92	55E4C4QQ	7	14	45	Test Product	5000	4750	1250	PENDING	2025-12-25 13:11:19.126	3750
93	55HS95WU	7	14	45	Test Product	5000	4750	1250	PENDING	2025-12-25 13:11:46.346	3750
94	5519WLE5	7	14	45	Test Product	5000	4750	1250	PENDING	2025-12-25 13:15:28.268	3750
95	550WLTB1	7	14	45	Test Product	5000	4750	1250	PENDING	2025-12-25 13:16:13.791	3750
96	55UZYE68	8	14	45	Test Product	5000	4750	1250	PENDING	2025-12-25 13:47:48.991	3750
97	55ED3P3Q	8	14	45	Test Product	5000	4750	1250	PENDING	2025-12-30 07:31:26.37	3750
98	MSFWBJLJ4	7	13	43	Microsoft 365 для семьи	1290000	1238400	129000	PENDING	2025-12-30 09:35:38.556	1161000
99	553GVTZE	8	14	45	Test Product	5000	4750	1250	PENDING	2026-01-09 11:26:08.042	3750
\.


--
-- Data for Name: VoucherWalletLog; Type: TABLE DATA; Schema: public; Owner: tguser
--

COPY public."VoucherWalletLog" (id, "voucherId", "clientId", "isAddedToWallet", "addedAt", "pkpassId", "deviceInfo") FROM stdin;
399	527	17	t	2025-12-09 13:43:59.436	\N	\N
400	527	17	f	2025-12-09 13:44:26.705	voucher.view	\N
401	528	19	t	2025-12-12 10:56:52.391	\N	\N
402	528	19	f	2025-12-15 12:24:25.168	voucher.view	\N
403	529	27	t	2025-12-17 17:52:33.661	\N	\N
404	528	19	f	2025-12-17 18:10:21.132	voucher.view	\N
405	528	19	f	2025-12-18 15:13:19.58	voucher.view	\N
406	529	27	f	2025-12-18 15:14:33.907	voucher.view	\N
407	529	27	f	2025-12-18 15:14:36.465	voucher.view	\N
408	529	27	f	2025-12-18 15:14:39.394	voucher.view	\N
409	530	28	t	2025-12-18 15:15:25.666	\N	\N
410	530	28	f	2025-12-18 15:15:30.47	voucher.view	\N
411	528	19	f	2025-12-21 12:56:08.862	voucher.view	\N
412	530	28	f	2025-12-21 13:00:57.552	voucher.view	\N
413	507	6	t	2025-12-25 03:26:28.462	\N	\N
414	532	29	t	2025-12-25 06:49:50.674	\N	\N
415	533	23	t	2025-12-25 06:55:02.173	\N	\N
416	534	6	t	2025-12-25 07:14:54.051	\N	\N
417	508	23	t	2025-12-25 07:26:28.877	\N	\N
418	508	23	f	2025-12-25 07:27:11.752	voucher.view	\N
419	509	23	t	2025-12-25 08:48:50.329	\N	\N
420	554	6	t	2025-12-25 13:11:19.122	\N	\N
421	555	23	t	2025-12-25 13:11:46.345	\N	\N
422	556	23	t	2025-12-25 13:15:28.267	\N	\N
423	557	29	t	2025-12-25 13:16:13.79	\N	\N
424	558	32	t	2025-12-25 13:47:48.989	\N	\N
425	554	6	f	2025-12-26 03:42:55.327	voucher.view	\N
426	507	6	f	2025-12-26 03:43:05.199	voucher.view	\N
427	507	6	f	2025-12-26 03:43:16.909	voucher.view	\N
428	556	23	f	2025-12-26 12:59:07.823	voucher.view	\N
429	534	6	f	2025-12-28 04:34:57.683	voucher.view	\N
430	554	6	f	2025-12-28 04:35:02.08	voucher.view	\N
431	507	6	f	2025-12-28 04:35:04.829	voucher.view	\N
432	554	6	f	2025-12-28 13:59:31.568	voucher.view	\N
433	559	6	t	2025-12-30 07:31:26.368	\N	\N
434	510	33	t	2025-12-30 09:35:38.549	\N	\N
435	509	23	f	2026-01-03 13:23:03.436	voucher.view	\N
436	508	23	f	2026-01-04 13:34:20.424	voucher.view	\N
437	508	23	f	2026-01-04 13:34:30.075	voucher.share	\N
438	560	32	t	2026-01-09 11:26:08.037	\N	\N
439	556	23	f	2026-01-17 07:56:26.676	voucher.view	\N
440	559	6	f	2026-01-20 04:24:21.512	voucher.view	\N
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
3fe67cf6-eaa3-4c42-bca3-13f87459a677	4dade769e845d0e11000821b866145144de71151732ac388b472640651627097	2025-12-24 19:27:41.232483+00	20251224192700_add_qr_payment_feature	\N	\N	2025-12-24 19:27:41.207817+00	1
b62df351-9c49-40da-8032-f258b6148bad	1afc3d3440c5e1452a55b96b3477b7e59e01d4554815a6499220036783100e97	\N	20251128092800_update_vendor_product_type_to_enum	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251128092800_update_vendor_product_type_to_enum\n\nDatabase error code: 42710\n\nDatabase error:\nERROR: type "VendorProductType" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42710), message: "type \\"VendorProductType\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("typecmds.c"), line: Some(1167), routine: Some("DefineEnum") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251128092800_update_vendor_product_type_to_enum"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20251128092800_update_vendor_product_type_to_enum"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:225	2025-12-24 19:27:38.920582+00	2025-12-24 19:27:25.262084+00	0
950bd0a4-b5d7-40eb-988b-ead5999f87b9	1afc3d3440c5e1452a55b96b3477b7e59e01d4554815a6499220036783100e97	2025-12-24 19:27:38.921555+00	20251128092800_update_vendor_product_type_to_enum		\N	2025-12-24 19:27:38.921555+00	0
\.


--
-- Name: AuditLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."AuditLog_id_seq"', 11, true);


--
-- Name: AuthSmsLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."AuthSmsLog_id_seq"', 24, true);


--
-- Name: Client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Client_id_seq"', 34, true);


--
-- Name: ManualActivationRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."ManualActivationRequest_id_seq"', 5, true);


--
-- Name: MerchantPayment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."MerchantPayment_id_seq"', 12, true);


--
-- Name: MerchantProductLink_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."MerchantProductLink_id_seq"', 6, true);


--
-- Name: Merchant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Merchant_id_seq"', 8, true);


--
-- Name: OnlineVoucher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."OnlineVoucher_id_seq"', 44, true);


--
-- Name: Product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Product_id_seq"', 45, true);


--
-- Name: QrPaymentAttempt_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."QrPaymentAttempt_id_seq"', 28, true);


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 95, true);


--
-- Name: RokkyApiLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."RokkyApiLog_id_seq"', 4, true);


--
-- Name: RokkyOrder_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."RokkyOrder_id_seq"', 5, true);


--
-- Name: RokkySku_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."RokkySku_id_seq"', 2, true);


--
-- Name: Sale_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Sale_id_seq"', 118, true);


--
-- Name: StoreTelegramBot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."StoreTelegramBot_id_seq"', 3, true);


--
-- Name: Store_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Store_id_seq"', 5, true);


--
-- Name: TelegramBot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."TelegramBot_id_seq"', 2, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."User_id_seq"', 23, true);


--
-- Name: VendorPayment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VendorPayment_id_seq"', 4, true);


--
-- Name: Vendor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Vendor_id_seq"', 14, true);


--
-- Name: VoucherActivation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherActivation_id_seq"', 22, true);


--
-- Name: VoucherSmsLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherSmsLog_id_seq"', 31, true);


--
-- Name: VoucherTransaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherTransaction_id_seq"', 99, true);


--
-- Name: VoucherWalletLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."VoucherWalletLog_id_seq"', 440, true);


--
-- Name: Voucher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tguser
--

SELECT pg_catalog.setval('public."Voucher_id_seq"', 608, true);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


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
-- Name: ManualActivationRequest ManualActivationRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."ManualActivationRequest"
    ADD CONSTRAINT "ManualActivationRequest_pkey" PRIMARY KEY (id);


--
-- Name: MerchantPayment MerchantPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantPayment"
    ADD CONSTRAINT "MerchantPayment_pkey" PRIMARY KEY (id);


--
-- Name: MerchantProductLink MerchantProductLink_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantProductLink"
    ADD CONSTRAINT "MerchantProductLink_pkey" PRIMARY KEY (id);


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
-- Name: QrPaymentAttempt QrPaymentAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."QrPaymentAttempt"
    ADD CONSTRAINT "QrPaymentAttempt_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: RokkyApiLog RokkyApiLog_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkyApiLog"
    ADD CONSTRAINT "RokkyApiLog_pkey" PRIMARY KEY (id);


--
-- Name: RokkyOrder RokkyOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkyOrder"
    ADD CONSTRAINT "RokkyOrder_pkey" PRIMARY KEY (id);


--
-- Name: RokkySku RokkySku_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkySku"
    ADD CONSTRAINT "RokkySku_pkey" PRIMARY KEY (id);


--
-- Name: Sale Sale_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_pkey" PRIMARY KEY (id);


--
-- Name: StoreTelegramBot StoreTelegramBot_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."StoreTelegramBot"
    ADD CONSTRAINT "StoreTelegramBot_pkey" PRIMARY KEY (id);


--
-- Name: Store Store_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Store"
    ADD CONSTRAINT "Store_pkey" PRIMARY KEY (id);


--
-- Name: TelegramBot TelegramBot_pkey; Type: CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."TelegramBot"
    ADD CONSTRAINT "TelegramBot_pkey" PRIMARY KEY (id);


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
-- Name: ManualActivationRequest_voucherId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "ManualActivationRequest_voucherId_key" ON public."ManualActivationRequest" USING btree ("voucherId");


--
-- Name: MerchantProductLink_merchantId_productId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "MerchantProductLink_merchantId_productId_key" ON public."MerchantProductLink" USING btree ("merchantId", "productId");


--
-- Name: MerchantProductLink_token_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "MerchantProductLink_token_key" ON public."MerchantProductLink" USING btree (token);


--
-- Name: Merchant_username_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "Merchant_username_key" ON public."Merchant" USING btree (username);


--
-- Name: OnlineVoucher_voucherId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "OnlineVoucher_voucherId_key" ON public."OnlineVoucher" USING btree ("voucherId");


--
-- Name: QrPaymentAttempt_saleId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "QrPaymentAttempt_saleId_key" ON public."QrPaymentAttempt" USING btree ("saleId");


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
-- Name: RokkyOrder_voucherId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "RokkyOrder_voucherId_key" ON public."RokkyOrder" USING btree ("voucherId");


--
-- Name: RokkySku_sku_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "RokkySku_sku_key" ON public."RokkySku" USING btree (sku);


--
-- Name: StoreTelegramBot_storeId_telegramBotId_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "StoreTelegramBot_storeId_telegramBotId_key" ON public."StoreTelegramBot" USING btree ("storeId", "telegramBotId");


--
-- Name: Store_slug_key; Type: INDEX; Schema: public; Owner: tguser
--

CREATE UNIQUE INDEX "Store_slug_key" ON public."Store" USING btree (slug);


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
-- Name: ManualActivationRequest ManualActivationRequest_operatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."ManualActivationRequest"
    ADD CONSTRAINT "ManualActivationRequest_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ManualActivationRequest ManualActivationRequest_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."ManualActivationRequest"
    ADD CONSTRAINT "ManualActivationRequest_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public."Voucher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MerchantPayment MerchantPayment_merchantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantPayment"
    ADD CONSTRAINT "MerchantPayment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES public."Merchant"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MerchantProductLink MerchantProductLink_merchantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantProductLink"
    ADD CONSTRAINT "MerchantProductLink_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES public."Merchant"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MerchantProductLink MerchantProductLink_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."MerchantProductLink"
    ADD CONSTRAINT "MerchantProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: Product Product_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Product Product_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QrPaymentAttempt QrPaymentAttempt_linkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."QrPaymentAttempt"
    ADD CONSTRAINT "QrPaymentAttempt_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES public."MerchantProductLink"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QrPaymentAttempt QrPaymentAttempt_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."QrPaymentAttempt"
    ADD CONSTRAINT "QrPaymentAttempt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: RokkyOrder RokkyOrder_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."RokkyOrder"
    ADD CONSTRAINT "RokkyOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public."Voucher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Sale Sale_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StoreTelegramBot StoreTelegramBot_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."StoreTelegramBot"
    ADD CONSTRAINT "StoreTelegramBot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StoreTelegramBot StoreTelegramBot_telegramBotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tguser
--

ALTER TABLE ONLY public."StoreTelegramBot"
    ADD CONSTRAINT "StoreTelegramBot_telegramBotId_fkey" FOREIGN KEY ("telegramBotId") REFERENCES public."TelegramBot"(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- PostgreSQL database dump complete
--

