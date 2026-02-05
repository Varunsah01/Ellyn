# AI Usage Tracking - Backend Implementation

## ✅ Implementation Complete

### **Files Created:**

1. **[lib/db/migrations/002_ai_usage_tracking.sql](lib/db/migrations/002_ai_usage_tracking.sql)** - Database Schema
2. **[app/api/ai/usage/route.ts](app/api/ai/usage/route.ts)** - Usage tracking endpoints
3. **[app/api/ai/remaining/route.ts](app/api/ai/remaining/route.ts)** - Remaining generations endpoint
4. **[app/api/ai/settings/route.ts](app/api/ai/settings/route.ts)** - AI settings management

---

## 📊 Database Schema

### **Tables Created:**

#### 1. `ai_usage` - Usage Tracking
```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  generation_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, date)
);
```

#### 2. `user_ai_settings` - User Settings
```sql
CREATE TABLE user_ai_settings (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id),
  ai_enabled BOOLEAN DEFAULT true,
  daily_ai_limit INTEGER DEFAULT 50,
  anthropic_api_key TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **Security:**
- ✅ Row Level Security (RLS) enabled
- ✅ Users can only access their own data
- ✅ Automatic `updated_at` triggers
- ✅ Indexed for performance

---

## 🔌 API Endpoints

### **1. GET /api/ai/usage**
Get AI usage statistics

**Query Parameters:**
- `period`: 'today' | 'week' | 'month' | 'all' (default: 'today')

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "used": 12,
      "remaining": 38,
      "dailyLimit": 50,
      "resetTime": "2025-01-16T00:00:00.000Z"
    },
    "period": {
      "type": "week",
      "totalGenerations": 45,
      "totalTokens": 9000,
      "totalCost": "0.0450",
      "records": [...]
    }
  }
}
```

### **2. POST /api/ai/usage**
Track an AI generation

**Request Body:**
```json
{
  "tokens": 200,
  "cost": 0.001
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "used": 13,
    "remaining": 37,
    "dailyLimit": 50,
    "tokens": 2600,
    "cost": "0.0130"
  }
}
```

**Error (429 - Limit Reached):**
```json
{
  "error": "Daily limit reached",
  "limit": 50,
  "used": 50
}
```

### **3. GET /api/ai/remaining**
Get remaining generations for today

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "dailyLimit": 50,
    "used": 12,
    "remaining": 38,
    "percentage": 24,
    "tokens": 2400,
    "cost": "0.0120",
    "resetTime": "2025-01-16T00:00:00.000Z",
    "timeUntilReset": {
      "hours": 8,
      "minutes": 45,
      "formatted": "8h 45m"
    }
  }
}
```

### **4. GET /api/ai/settings**
Get user AI settings

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "user_id": "...",
    "ai_enabled": true,
    "daily_ai_limit": 50,
    "has_api_key": true,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### **5. PUT /api/ai/settings**
Update user AI settings

**Request Body:**
```json
{
  "ai_enabled": true,
  "daily_ai_limit": 100,
  "anthropic_api_key": "sk-ant-..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "Settings updated successfully"
}
```

### **6. DELETE /api/ai/settings**
Delete user's API key

**Response:**
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

---

## 🔗 Extension Integration

### **Update Extension's AI Generator:**

```javascript
// extension/utils/ai-draft-generator.js

class AIDraftGenerator {
  constructor() {
    this.useBackendSync = true; // Enable backend sync
  }

  async generateDraft(params) {
    // Check remaining with backend
    const remaining = await this.checkBackendRemaining();

    if (remaining <= 0) {
      throw new Error('Daily limit reached');
    }

    // Generate draft...
    const result = await this.callClaudeAPI(params);

    // Track usage with backend
    await this.trackWithBackend({
      tokens: result.usage.inputTokens + result.usage.outputTokens,
      cost: this.calculateCost(result.usage)
    });

    return result;
  }

  async checkBackendRemaining() {
    try {
      const response = await fetch('http://localhost:3001/api/ai/remaining', {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      const data = await response.json();
      return data.data.remaining;

    } catch (error) {
      console.warn('[AI] Backend sync failed, using local:', error);
      // Fallback to local storage
      return await this.getRemainingGenerations();
    }
  }

  async trackWithBackend({ tokens, cost }) {
    try {
      const response = await fetch('http://localhost:3001/api/ai/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ tokens, cost })
      });

      const data = await response.json();

      if (response.status === 429) {
        throw new Error('Daily limit reached');
      }

      // Update local storage to match backend
      await this.syncLocalStorage(data.data);

      return data;

    } catch (error) {
      console.warn('[AI] Backend tracking failed:', error);
      // Fallback to local tracking
      await this.trackUsage();
    }
  }

  async syncLocalStorage(backendData) {
    // Update local aiUsage to match backend
    const today = new Date().toISOString().split('T')[0];

    await chrome.storage.local.set({
      aiUsage: {
        [today]: {
          count: backendData.used,
          totalCost: parseFloat(backendData.cost),
          lastSynced: new Date().toISOString()
        }
      }
    });
  }

  async getAuthToken() {
    // Get auth token from storage or prompt user
    const storage = await chrome.storage.local.get(['authToken']);
    return storage.authToken || null;
  }
}
```

### **Add Sync Status UI:**

```javascript
// extension/sidepanel/ai-generation.js

async function updateSyncStatus() {
  try {
    const response = await fetch('http://localhost:3001/api/ai/remaining', {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
      }
    });

    if (response.ok) {
      const data = await response.json();

      // Update UI with backend data
      document.getElementById('remaining-generations').textContent =
        `${data.data.remaining} generations remaining today`;

      // Show synced status
      updateStatusIndicator('synced', 'Synced with cloud');

    } else {
      updateStatusIndicator('warning', 'Using local storage');
    }

  } catch (error) {
    updateStatusIndicator('error', 'Offline mode');
  }
}

function updateStatusIndicator(status, message) {
  const indicator = document.getElementById('sync-indicator');

  const icons = {
    synced: '☁️',
    warning: '⚠️',
    error: '❌'
  };

  indicator.innerHTML = `${icons[status]} ${message}`;
  indicator.className = `sync-indicator ${status}`;
}
```

---

## 🧪 Testing Guide

### **1. Database Setup**

Run the migration:

```bash
# Using Supabase CLI
supabase db reset

# Or run SQL directly in Supabase dashboard
# Copy contents of lib/db/migrations/002_ai_usage_tracking.sql
```

### **2. API Tests**

```bash
# Get remaining generations
curl http://localhost:3001/api/ai/remaining \
  -H "Authorization: Bearer YOUR_TOKEN"

# Track a generation
curl -X POST http://localhost:3001/api/ai/usage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"tokens": 200, "cost": 0.001}'

# Get usage statistics
curl "http://localhost:3001/api/ai/usage?period=week" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update settings
curl -X PUT http://localhost:3001/api/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"daily_ai_limit": 100}'
```

### **3. Extension Integration Test**

1. Open extension
2. Generate AI email
3. Check browser console for `[AI] Backend sync...` logs
4. Verify backend shows updated count
5. Open extension on different device
6. Verify usage syncs correctly

---

## 🔐 Security Considerations

### **API Key Storage:**

**Option 1: Store in Backend (Current)**
- ✅ Syncs across devices
- ✅ Centrally managed
- ⚠️ Requires encryption at rest
- ⚠️ Backend has access

**Option 2: Store Locally Only**
- ✅ User has full control
- ✅ No backend access
- ❌ Doesn't sync across devices
- ❌ Lost if extension uninstalled

**Recommended:** Give user choice in settings

### **Data Privacy:**

- ✅ RLS ensures users only see their own data
- ✅ API key never returned in responses
- ✅ No email content stored
- ✅ Only metadata tracked (tokens, cost)

---

## 📊 Usage Analytics Dashboard

### **Add to Web App:**

```typescript
// app/dashboard/ai-usage/page.tsx

export default async function AIUsagePage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  const { data: usage } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(30);

  return (
    <div>
      <h1>AI Usage Analytics</h1>

      <div className="stats">
        <StatCard
          title="Today"
          value={usage[0]?.generation_count || 0}
          subtitle="generations"
        />
        <StatCard
          title="This Month"
          value={usage.reduce((sum, u) => sum + u.generation_count, 0)}
          subtitle="generations"
        />
        <StatCard
          title="Total Cost"
          value={`$${usage.reduce((sum, u) => sum + parseFloat(u.estimated_cost), 0).toFixed(2)}`}
          subtitle="this month"
        />
      </div>

      <UsageChart data={usage} />
    </div>
  );
}
```

---

## 🚀 Deployment Checklist

- [ ] Run database migration
- [ ] Test all endpoints with auth
- [ ] Update extension to use backend APIs
- [ ] Add error handling for offline mode
- [ ] Implement sync retry logic
- [ ] Add usage dashboard to web app
- [ ] Document API for users
- [ ] Set up monitoring for usage spikes

---

## 📝 Future Enhancements

### **Phase 2:**
- [ ] Usage analytics dashboard
- [ ] Cost optimization suggestions
- [ ] Bulk usage reports
- [ ] API key rotation
- [ ] Team usage pooling

### **Phase 3:**
- [ ] WebSocket for real-time sync
- [ ] Offline queue for failed syncs
- [ ] Usage predictions
- [ ] Budget alerts

---

**Implementation Date:** 2025-01-15
**Version:** 1.0.0
**Status:** ✅ Backend Complete, Extension Integration Pending
