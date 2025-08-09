# Security Improvements TODO

This document outlines critical security issues and improvements needed for the authentication system.

## 🚨 **Critical Security Issues**

### 1. **Insecure JWT Cookie Storage**
**Current Issue**: 
```typescript
// client/src/contexts/AuthContext.tsx:64-66
const authToken = Cookies.get('auth_token');
if (authToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
```
**Problem**: JWT stored in regular cookies, vulnerable to XSS attacks  
**Fix**: Use `httpOnly`, `secure`, and `sameSite` cookie flags

### 2. **Weak Encryption Key Derivation**
**Current Issue**:
```python
# app/utils/auth.py:29
key = base64.urlsafe_b64encode(settings.SECRET_KEY.encode()[:32].ljust(32, b'0'))
```
**Problem**: Weak key derivation - just truncates/pads SECRET_KEY  
**Fix**: Use proper KDF like PBKDF2 or Argon2

### 3. **No Server-Side Token Revocation**
**Current Issue**:
```python
# app/api/routes/auth.py:398
# In a real application, you might want to invalidate tokens or sessions
return {"message": "Logged out successfully"}
```
**Problem**: JWT tokens remain valid after logout until expiry  
**Fix**: Implement token blacklist or use shorter-lived tokens with refresh mechanism

### 4. **User ID Exposure in OAuth State**
**Current Issue**:
```python
# app/api/routes/auth.py:217
"state": user_id,  # Use state to store user_id
```
**Problem**: Exposes internal user IDs in URLs/logs  
**Fix**: Use cryptographically secure random state mapped to user_id

## ⚠️ **High Priority Issues**

### 5. **No Refresh Token Mechanism**
**Problem**: 
- 30-minute token expiry causes poor UX
- Users must re-authenticate frequently
**Fix**: Implement refresh token pattern

### 6. **Mixed GitHub OAuth/App Flow**
**Current Issue**:
```python
# app/api/routes/auth.py:343-349
# Redirect to GitHub App installation page instead of frontend
app_name = "radar-notifier-dev"
installation_url = f"https://github.com/apps/{app_name}/installations/new"
```
**Problem**: Confusing OAuth App with GitHub App installation  
**Fix**: Separate these flows clearly

### 7. **No Rate Limiting on Auth Endpoints**
**Problem**: Auth endpoints vulnerable to brute force  
**Fix**: Add rate limiting specifically for auth routes

### 8. **Client-Side Token Validation Bypass**
**Current Issue**:
```typescript
// client/src/contexts/AuthContext.tsx:51-59
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
};
```
**Problem**: Client can bypass expiry check  
**Fix**: Always validate server-side, don't trust client

## 🔧 **Recommended Improvements**

### 1. **Implement Secure Session Management**
```python
# Suggested approach
class SessionManager:
    @staticmethod
    def create_session(user_id: str) -> tuple[str, str]:
        """Return (access_token, refresh_token)"""
        access_token = create_jwt(user_id, expires_minutes=15)
        refresh_token = create_secure_token()  # Store in DB
        return access_token, refresh_token
```

### 2. **Use Proper Cookie Security**
```python
# Set secure cookies server-side
response.set_cookie(
    "access_token",
    token,
    httponly=True,
    secure=True,
    samesite="strict",
    max_age=900  # 15 minutes
)
```

### 3. **Implement Token Blacklist**
```python
class TokenManager:
    @staticmethod
    async def revoke_token(token: str):
        """Add token to blacklist in Redis/Database"""
        # Store token hash with expiry time
        await redis.setex(f"blacklist:{token_hash}", ttl, "revoked")
```

### 4. **Separate Encryption Keys**
```python
# Use dedicated encryption key, not derived from JWT secret
EXTERNAL_TOKEN_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")
# Use proper KDF if deriving keys
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

key = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=salt,
    iterations=100000,
).finalize(password)
```

### 5. **Add Comprehensive Auth Middleware**
```python
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Validate JWT server-side
    # Check token blacklist
    # Handle token refresh
    # Add security headers
    pass
```

### 6. **Implement Supabase RLS**
```sql
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own data" 
ON users FOR ALL 
USING (auth.uid() = id);
```

### 7. **Add CSRF Protection**
```python
# Add CSRF tokens for state-changing operations
# Use double-submit cookie pattern or synchronizer tokens
```

### 8. **Implement Security Headers**
```python
# Add security headers middleware
headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY", 
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'"
}
```

## 🎯 **Implementation Priority Order**

### **Phase 1 (Critical - Do First)**
1. **Fix cookie security & implement refresh tokens**
   - [ ] Implement httpOnly cookies server-side
   - [ ] Add refresh token mechanism
   - [ ] Reduce access token expiry to 15 minutes

2. **Add server-side token validation & blacklist**
   - [ ] Create token blacklist system
   - [ ] Add server-side validation middleware
   - [ ] Implement proper logout with token revocation

### **Phase 2 (High Priority)**
3. **Improve encryption key management**
   - [ ] Use dedicated encryption keys for external tokens
   - [ ] Implement proper KDF for key derivation
   - [ ] Add key rotation mechanism

4. **Add rate limiting to auth endpoints**
   - [ ] Implement rate limiting middleware
   - [ ] Add specific limits for auth endpoints
   - [ ] Add IP-based blocking for abuse

### **Phase 3 (Important)**
5. **Separate OAuth flows properly**
   - [ ] Clean up GitHub OAuth vs App installation flow
   - [ ] Add proper error handling and redirects
   - [ ] Improve state parameter security

6. **Implement comprehensive session management**
   - [ ] Add session tracking and management
   - [ ] Implement concurrent session limits
   - [ ] Add session analytics and monitoring

### **Phase 4 (Security Hardening)**
7. **Add comprehensive security measures**
   - [ ] Implement CSRF protection
   - [ ] Add security headers middleware
   - [ ] Enable Supabase RLS
   - [ ] Add audit logging for auth events

## 📋 **Testing Checklist**

After implementing fixes, test:
- [ ] Token expiry and refresh flow
- [ ] Logout properly revokes tokens
- [ ] Rate limiting blocks excessive requests
- [ ] XSS attacks cannot steal tokens
- [ ] CSRF attacks are blocked
- [ ] Concurrent sessions work properly
- [ ] OAuth flows handle errors gracefully

## 🔍 **Security Audit Items**

Before production:
- [ ] Penetration testing of auth flows
- [ ] Code review of all auth-related code  
- [ ] Dependency security scanning
- [ ] Secrets management audit
- [ ] Infrastructure security review