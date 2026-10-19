# SRC API — backend foundation

Java 21, Spring Boot 3.4.x, Spring Security, JPA, H2 local and PostgreSQL production.

## Start locally
```bash
export SRC_ADMIN_USERNAME=srcadmin
export SRC_ADMIN_PASSWORD='replace-with-a-unique-strong-password'
cd backend
mvn test
mvn spring-boot:run
```

Windows PowerShell:
```powershell
$env:SRC_ADMIN_USERNAME="srcadmin"
$env:SRC_ADMIN_PASSWORD="replace-with-a-unique-strong-password"
cd backend
mvn test
mvn spring-boot:run
```

Admin password must be at least 16 characters. No default privileged login is provisioned.

## API routes
- `GET /actuator/health`: health
- `GET /api/catalog/products`: only published products
- `GET /api/admin/products`: authenticated admin
- `POST /api/admin/products`: authenticated admin, validated JSON
- `PUT /api/admin/products/{id}`: authenticated admin
- `DELETE /api/admin/products/{id}`: authenticated admin

For authenticated admin requests, HTTP Basic auth is currently a temporary developer-only credential mechanism. **Do not publicly deploy the admin API without production auth redesign, HTTPS ingress, rate limiting, audit trail and authorization testing.** No checkout or fireworks orders are implemented.

Sample product:
```json
{"name":"Classic Sparklers","category":"Sparklers","description":"In-store catalogue listing","published":true,"fireworks":true,"imageUrl":"https://example.org/image.jpg","demoVideoUrl":"https://example.org/demo.mp4"}
```

## Production gaps
- Flyway SQL migrations (currently JPA ddl update; don't use in production)
- Proper employee/agent/customer identity and RBAC, account lifecycle, MFA, sessions
- Images/video CDN, category and hero CMS tables, stock and warehouse controls
- Negative tests, build verification, CORS and error standards, observability
- Any lawful non-fireworks transaction workflow subject to review

No fireworks online order, reservation, pickup prep, delivery or payment is supported.
