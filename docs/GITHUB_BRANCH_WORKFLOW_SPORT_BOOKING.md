# GitHub Branch & Workflow Guide — Sport Booking System

> **Project:** Sport Booking System — Nhóm 9  
> **Repository:** https://github.com/Sukuna092main/sport-booking-system.git  
> **Team:** Huy — PM + Backend Lead · Duy — Frontend Lead · Hưng — DevOps + QA  
> **Mục tiêu:** thống nhất cách tạo nhánh, commit, push, Pull Request, review, CI, merge và release để tránh ghi đè code của nhau.

---

## 1. Nguyên tắc chung

Workflow của dự án:

```text
Trello Card
    ↓
Tạo branch từ develop
    ↓
Code + tự test
    ↓
Push branch
    ↓
Pull Request → develop
    ↓
Code Review
    ↓
GitHub Actions / CI / Test
    ↓
Merge vào develop
    ↓
Deploy Staging
    ↓
QA / Regression
    ↓
PR develop → main khi đủ điều kiện release
```

### Quy tắc bắt buộc

1. **Không push trực tiếp vào `main`.**
2. Nên **không push trực tiếp vào `develop`**; thay đổi đi qua Pull Request.
3. Mỗi task/Trello Card nên có **một branch riêng**.
4. Branch công việc phải được tạo từ bản `develop` mới nhất.
5. Một Pull Request nên tập trung vào **một task hoặc một nhóm thay đổi liên quan chặt chẽ**.
6. Code phải được tự test trước khi mở PR.
7. PR phải qua review và CI/test trước khi merge.
8. Sau khi merge, xóa branch công việc để repository gọn.
9. Không commit `.env`, password, token, secret, private key hoặc credential.
10. Không dùng `git push --force` lên `main`, `develop` hoặc branch của người khác.

---

# 2. Danh sách nhánh

## 2.1. Nhánh cố định

| Branch | Mục đích | Ai được merge |
|---|---|---|
| `main` | Bản ổn định, dùng cho release/demo | PM/Lead sau khi QA đạt |
| `develop` | Nhánh tích hợp code của sprint | Merge thông qua Pull Request |

### `main`

`main` chỉ chứa phiên bản đã được kiểm tra và đủ điều kiện release.

```text
develop
   ↓
Staging + QA
   ↓
PR develop → main
   ↓
Release
```

Không phát triển tính năng trực tiếp trên `main`.

### `develop`

`develop` là nơi tích hợp các feature đã hoàn thành.

Tất cả nhánh `feature/*`, `fix/*`, `docs/*` mặc định tạo từ `develop` và Pull Request trở lại `develop`.

---

## 2.2. Nhánh công việc

### Quy định nhánh Backend — Huy chốt 08/10/2026

Task Backend dùng `be_<ten_task>`, viết thường và ngăn cách bằng dấu gạch dưới.
Ví dụ: `be_auth_register_login`, `be_auth_role_middleware`, `be_user_profile`,
`be_court_data_foundation`, `be_court_list_detail`, `be_court_availability`.
Tạo từ `develop` mới nhất, mỗi task một nhánh/PR vào `develop`, test và review trước merge.

### `feature/*`

Dùng cho tính năng mới.

Ví dụ phù hợp với Sport Booking System:

```text
be_auth_register_login
be_auth_role_middleware
be_user_profile
be_court_list_detail
be_court_availability
be_court_blackout
be_booking_create
be_booking_history
be_booking_cancel
be_admin_court_management
be_admin_booking_management
feature/github-actions-ci
feature/docker-compose
```

### `fix/*`

Dùng để sửa bug.

```text
fix/double-booking
fix/booking-cancel-permission
fix/login-validation
fix/availability-conflict
fix/court-blackout-validation
fix/admin-role-check
```

### `docs/*`

Dùng cho thay đổi tài liệu nằm trong repository.

```text
docs/readme-update
docs/api-openapi
docs/srs-update
docs/deployment-guide
docs/github-workflow
```

> Nhánh công việc là **nhánh tạm thời**. Sau khi PR được merge thì nên xóa.

---

# 3. Quy tắc đặt tên branch

Cấu trúc:

```text
<type>/<noi-dung-ngan-gon>
```

Ví dụ:

```text
be_booking_create
fix/double-booking
docs/api-openapi
```

### Nên

```text
be_court_availability
be_booking_cancel
fix/login-validation
```

### Không nên

```text
huy
branch1
test
code-moi
feature123
final-final
```

Tên branch:

- viết thường;
- dùng dấu `-` để ngăn cách từ;
- không dùng dấu tiếng Việt;
- mô tả đúng task đang làm;
- không quá dài.

---

# 4. Commit Convention

Dự án sử dụng các prefix:

| Prefix | Khi sử dụng |
|---|---|
| `feat:` | Thêm tính năng mới |
| `fix:` | Sửa lỗi |
| `test:` | Thêm/chỉnh test |
| `docs:` | Chỉnh tài liệu |
| `refactor:` | Cải tiến code nhưng không thay đổi hành vi |
| `chore:` | Công việc kỹ thuật/phụ trợ |

Ví dụ:

```bash
git commit -m "feat: implement booking creation"
git commit -m "feat: add court availability API"
git commit -m "fix: prevent duplicate booking"
git commit -m "fix: validate booking ownership before cancel"
git commit -m "test: add booking concurrency test"
git commit -m "docs: update local setup guide"
git commit -m "refactor: extract booking validation service"
git commit -m "chore: update docker compose configuration"
```

### Một commit tốt

```text
feat: add court blackout validation
```

### Một commit không tốt

```text
update
fix code
done
code moi
final
abc
```

---

# 5. Thiết lập repository lần đầu

## 5.1. Clone project

```bash
git clone https://github.com/Sukuna092main/sport-booking-system.git
cd sport-booking-system
```

Kiểm tra remote:

```bash
git remote -v
```

Kết quả cần trỏ về repository của project.

---

## 5.2. Lấy toàn bộ branch từ GitHub

```bash
git fetch --all --prune
git branch -a
```

---

## 5.3. Chuyển sang `develop`

Nếu `develop` đã có trên remote:

```bash
git switch develop
git pull origin develop
```

Nếu repository **chưa có `develop`**, chỉ PM/Lead cần tạo một lần:

```bash
git switch main
git pull origin main

git switch -c develop
git push -u origin develop
```

Sau đó các thành viên khác chỉ cần:

```bash
git fetch origin
git switch develop
git pull origin develop
```

---

# 6. Quy trình làm một task mới

Ví dụ task:

```text
[BE] Booking Create
```

Branch:

```text
be_booking_create
```

## Bước 1 — cập nhật `develop`

```bash
git switch develop
git pull origin develop
```

## Bước 2 — tạo branch

```bash
git switch -c be_booking_create
```

Kiểm tra:

```bash
git branch
```

Branch hiện tại sẽ có dấu `*`.

---

## Bước 3 — code

Trong lúc làm có thể kiểm tra:

```bash
git status
```

Xem thay đổi:

```bash
git diff
```

---

## Bước 4 — add và commit

Add toàn bộ file cần commit:

```bash
git add .
```

Kiểm tra lần cuối:

```bash
git status
```

Commit:

```bash
git commit -m "feat: implement booking creation"
```

> Trước `git add .`, phải kiểm tra chắc chắn `.env`, secret và file không cần thiết đã nằm trong `.gitignore`.

---

## Bước 5 — push branch lên GitHub

Lần đầu:

```bash
git push -u origin be_booking_create
```

Những lần sau:

```bash
git push
```

---

# 7. Tạo Pull Request

Sau khi push branch:

1. Mở repository trên GitHub.
2. Chọn **Pull requests**.
3. Chọn **New pull request**.
4. Thiết lập:

```text
base:    develop
compare: be_booking_create
```

5. Kiểm tra file thay đổi.
6. Tạo PR.
7. Gắn link Trello Card tương ứng trong mô tả PR.
8. Chờ review và CI.

---

# 8. Mẫu Pull Request

```markdown
## Task

[BE] Booking Create

Trello:
<LINK_TRELLO_CARD>

## Nội dung

- Thêm API tạo booking.
- Validate court và time slot.
- Kiểm tra blackout.
- Kiểm tra slot liên tiếp.
- Thêm transaction khi tạo booking.

## Test

- [x] Build thành công
- [x] Test API local
- [x] Validate request lỗi
- [x] Kiểm tra booking conflict
- [ ] QA trên staging

## Lưu ý

Không thay đổi API ngoài phạm vi task.
```

---

# 9. Khi reviewer yêu cầu sửa PR

Không cần tạo PR mới.

Chuyển về đúng branch:

```bash
git switch be_booking_create
```

Sửa code rồi:

```bash
git add .
git commit -m "fix: address pull request review"
git push
```

PR trên GitHub sẽ tự cập nhật commit mới.

---

# 10. Đồng bộ branch khi `develop` thay đổi

Giả sử đang làm:

```text
be_booking_create
```

Trong lúc đó có người khác merge code mới vào `develop`.

Cập nhật:

```bash
git switch develop
git pull origin develop

git switch be_booking_create
git merge develop
```

Nếu không conflict:

```bash
git push
```

Đối với team sinh viên, ưu tiên `merge develop` để thao tác rõ ràng và tránh phải force-push sau rebase.

---

# 11. Xử lý merge conflict

Sau:

```bash
git merge develop
```

Nếu Git báo conflict:

```bash
git status
```

Trong file conflict sẽ có dạng:

```text
<<<<<<< HEAD
code của branch hiện tại
=======
code từ develop
>>>>>>> develop
```

Thực hiện:

1. Đọc cả hai phần.
2. Giữ code đúng hoặc kết hợp hai phần.
3. Xóa các marker:

```text
<<<<<<<
=======
>>>>>>>
```

4. Add file đã sửa:

```bash
git add .
```

5. Hoàn tất merge:

```bash
git commit -m "chore: resolve merge conflict with develop"
```

6. Push:

```bash
git push
```

Nếu không chắc cách resolve conflict thì **không chọn bừa `Accept Current` hoặc `Accept Incoming`**; trao đổi với owner của phần code liên quan.

---

# 12. Sau khi PR được merge

Cập nhật local:

```bash
git switch develop
git pull origin develop
```

Xóa branch local:

```bash
git branch -d be_booking_create
```

Dọn branch remote đã bị xóa:

```bash
git fetch --prune
```

Nếu GitHub chưa tự xóa branch remote, có thể xóa:

```bash
git push origin --delete be_booking_create
```

---

# 13. Quy trình sửa bug

Ví dụ QA phát hiện double-booking.

```bash
git switch develop
git pull origin develop

git switch -c fix/double-booking
```

Sửa và test:

```bash
git add .
git commit -m "fix: prevent concurrent double booking"
git push -u origin fix/double-booking
```

Tạo PR:

```text
fix/double-booking → develop
```

Sau khi CI + review + QA đạt thì merge.

---

# 14. Quy trình cập nhật tài liệu

Ví dụ cập nhật OpenAPI:

```bash
git switch develop
git pull origin develop

git switch -c docs/api-openapi
```

Sau khi sửa:

```bash
git add .
git commit -m "docs: update booking API documentation"
git push -u origin docs/api-openapi
```

PR:

```text
docs/api-openapi → develop
```

---

# 15. Quy trình release

Code không đi trực tiếp từ feature lên `main`.

Luồng:

```text
feature/*
fix/*
docs/*
    ↓
 develop
    ↓
 Staging
    ↓
 QA / Regression
    ↓
 PR develop → main
    ↓
 Release
```

Trước khi PR `develop → main`:

- CI pass.
- Build pass.
- Test quan trọng pass.
- Không còn blocker/critical bug.
- QA xác nhận.
- Tài liệu/API docs cần thiết đã cập nhật.
- Demo/staging hoạt động.
- PM xác nhận release.

---

# 16. Version tag

Khi PM xác nhận một version đã release, có thể tạo tag.

Ví dụ:

```bash
git switch main
git pull origin main

git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

Xem tag:

```bash
git tag
```

> Chỉ tạo tag sau khi version thực sự đã được merge vào `main`.

---

# 17. Ai làm gì trong Git workflow

| Thành viên | Vai trò chính |
|---|---|
| **Huy — PM + Backend Lead** | Review/merge backend, quản lý integration, quyết định release |
| **Duy — Frontend Lead** | Feature frontend, tích hợp API, tự test UI trước PR |
| **Hưng — DevOps + QA** | GitHub Actions, CI/CD, staging, test, regression, release evidence |

Tất cả thành viên:

- tạo branch riêng;
- commit rõ nghĩa;
- push branch;
- mở PR;
- xử lý review;
- không sửa trực tiếp `main`.

---

# 18. Mapping task → branch gợi ý cho project

| Nhóm | Task | Branch |
|---|---|---|
| Backend | Auth Register/Login | `be_auth_register_login` |
| Backend | Authorization Middleware | `be_auth_role_middleware` |
| Backend | User/Profile | `be_user_profile` |
| Backend | Court | `be_court_management` |
| Backend | TimeSlot | `be_time_slot` |
| Backend | CourtBlackout | `be_court_blackout` |
| Backend | Availability | `be_court_availability` |
| Backend | Booking | `be_booking_create` |
| Backend | Booking History | `be_booking_history` |
| Backend | Cancel Booking | `be_booking_cancel` |
| Backend | Admin API | `be_admin_api` |
| Frontend | Auth UI | `feature/frontend-auth` |
| Frontend | Court UI | `feature/frontend-court` |
| Frontend | Availability UI | `feature/frontend-availability` |
| Frontend | Booking UI | `feature/frontend-booking` |
| Frontend | My Booking | `feature/frontend-my-booking` |
| Frontend | Admin UI | `feature/frontend-admin` |
| DevOps | Docker Compose | `feature/docker-compose` |
| DevOps | GitHub Actions CI | `feature/github-actions-ci` |
| DevOps | Staging | `feature/staging-deployment` |
| QA | Fix bug booking | `fix/booking-<ten-loi>` |
| Docs | README | `docs/readme-update` |
| Docs | OpenAPI | `docs/api-openapi` |

> Bảng trên là **quy ước đặt tên gợi ý theo module/task**. Chỉ tạo branch khi task bắt đầu; không cần tạo sẵn toàn bộ branch.

---

# 19. Các lệnh Git thường dùng

## Xem branch

```bash
git branch
git branch -a
```

## Chuyển branch

```bash
git switch develop
```

## Tạo branch mới

```bash
git switch -c be_booking_create
```

## Kiểm tra thay đổi

```bash
git status
git diff
```

## Lấy code mới

```bash
git pull origin develop
```

## Push

```bash
git push
```

## Xem lịch sử

```bash
git log --oneline --graph --decorate --all
```

## Xóa branch local

```bash
git branch -d be_booking_create
```

## Dọn reference branch cũ

```bash
git fetch --prune
```

---

# 20. Các lỗi thường gặp

## `fatal: not a git repository`

Đang đứng sai thư mục.

```bash
cd sport-booking-system
```

---

## `Your branch is behind 'origin/develop'`

Cập nhật branch:

```bash
git pull origin develop
```

---

## `rejected non-fast-forward`

Không force push ngay.

```bash
git pull
```

Nếu đang ở feature branch và `develop` vừa thay đổi:

```bash
git switch develop
git pull origin develop

git switch <feature-branch>
git merge develop
git push
```

---

## Code chưa commit nhưng cần đổi branch

Kiểm tra:

```bash
git status
```

Nếu chưa muốn commit, có thể stash:

```bash
git stash
git switch develop
```

Lấy lại:

```bash
git switch <branch-cu>
git stash pop
```

---

## Commit nhầm branch

Nếu **chưa push**, dừng lại và báo người review/PM nếu không chắc cách sửa.

Không dùng `reset --hard`, `force push` hoặc xóa commit tùy tiện trên branch dùng chung.

---

# 21. Checklist trước khi mở PR

```text
[ ] Branch được tạo từ develop mới nhất
[ ] Đúng phạm vi Trello Card
[ ] Không commit .env / secret
[ ] Build thành công
[ ] Đã tự test
[ ] Không còn code debug thừa
[ ] Commit message đúng convention
[ ] Đã pull/merge develop mới nhất nếu cần
[ ] PR base là develop
[ ] Có link Trello Card
[ ] Mô tả rõ thay đổi và cách test
```

---

# 22. Checklist trước khi merge

```text
[ ] Acceptance Criteria đạt
[ ] Reviewer đã review
[ ] CI pass
[ ] Test phù hợp pass
[ ] Không còn blocker/critical bug
[ ] Conflict đã xử lý
[ ] API/docs được cập nhật nếu cần
[ ] QA xác nhận nếu task cần staging
```

---

# 23. Tóm tắt nhanh cho thành viên

Mỗi lần bắt đầu task:

```bash
git switch develop
git pull origin develop
git switch -c feature/<task>
```

Sau khi code:

```bash
git status
git add .
git commit -m "feat: ..."
git push -u origin feature/<task>
```

Trên GitHub:

```text
Create Pull Request
feature/<task> → develop
↓
Review
↓
CI
↓
Merge
```

Sau khi merge:

```bash
git switch develop
git pull origin develop
git branch -d feature/<task>
git fetch --prune
```

---

## Quy tắc quan trọng nhất

> **Không code trực tiếp trên `main`.  
> Mỗi task một branch.  
> Mỗi branch một PR vào `develop`.  
> Chỉ đưa `develop` lên `main` sau khi review + CI + QA đạt.**
