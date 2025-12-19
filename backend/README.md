# SecondBrain Backend

FastAPI backend for SecondBrain - Provides optional deals matching and points system.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start Databases

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432) - User data

### 3. Run Database Migrations

```bash
# Initialize Alembic (first time only)
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

### 4. Start API Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

## 📚 API Endpoints

### Deals
- `GET /api/v1/deals` - Get relevant deals
- `POST /api/v1/deals/{id}/click` - Record deal click

### Points
- `GET /api/v1/points/balance` - Get points balance
- `GET /api/v1/points/redemptions/options` - Get redemption options
- `POST /api/v1/points/redemptions/redeem` - Redeem points

### Attribution (Server-Side)
- `GET /api/v1/r/{short_id}` - Server-side attribution redirect

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key settings:
- `POSTGRES_*` - PostgreSQL connection
- `TREMENDOUS_API_KEY` - Payout partner API key
- `SECRET_KEY` - JWT secret (change in production!)

## 🧪 Testing

```bash
pytest
```

## 📦 Database Models

### PostgreSQL
- `users` - User accounts (anonymous IDs)
- `points_ledger` - Points transactions (NOT real money)
- `redemption_history` - Redemption records
- `api_tokens` - API authentication
- `product_catalog` - Deals and products database
- `user_signals` - Aggregated user interest signals

## 🛡️ Privacy & Security

- **No PII storage** - Only hashed anonymous IDs
- **Points system** - Not real money (avoids money transmitter laws)
- **No page content stored** - Only aggregated signals
- **Server-side attribution** - Survives Brave Shields parameter stripping
- **Local-first architecture** - Sensitive data stays on user's device

## 🔥 Fraud Detection

Behavioral-based system (Brave-compatible):
- Velocity checks (40%): events/hour, domains/day
- Behavioral entropy (30%): mouse, scroll patterns
- Timing patterns (20%): inter-event intervals
- Fingerprinting (<10%): De-emphasized for Brave

## 📊 Monitoring

### Check Database Status

```bash
# PostgreSQL
docker exec -it datapay-postgres psql -U datapay -d datapay
```

### View Logs

```bash
docker-compose logs -f
```

## 🚢 Production Deployment

1. Use managed databases (RDS, Cloud SQL)
2. Set `ENVIRONMENT=production` and `DEBUG=false`
3. Change `SECRET_KEY` to strong random value
4. Configure real payout partner credentials
5. Set up monitoring (Prometheus, Grafana, Sentry)
6. Enable HTTPS/TLS
7. Configure rate limiting
8. Set up automated backups

## 📄 License

Proprietary - All Rights Reserved

