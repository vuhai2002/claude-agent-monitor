# Claude subagent monitor

Dashboard localhost cho biết subagent nào của Claude Code đang chạy - thông tin mà giao diện Claude Code Desktop không hiển thị ra.

## Chạy

Bấm đúp vào `start-monitor.bat`. Trình duyệt tự mở, đóng cửa sổ đen là tắt server.

Hoặc chạy tay từ trong thư mục project:

```bash
node server.js
```

Rồi mở http://localhost:4478

Không cần cài dependency. Chỉ dùng module có sẵn của Node.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `AGENT_MONITOR_PORT` | `4478` | Port của dashboard |
| `AGENT_MONITOR_PROJECTS_ROOT` | `~/.claude/projects` | Thư mục transcript cần quét |
| `AGENT_MONITOR_STALE_MS` | `600000` | Im lặng bao lâu thì coi là "không rõ" |
| `AGENT_MONITOR_MAX_AGE_MS` | `86400000` | Chỉ hiện agent có hoạt động trong khoảng này |
| `AGENT_MONITOR_SETTLE_MS` | `5000` | Chờ transcript lặng bao lâu trước khi kết luận đã xong |
| `AGENT_MONITOR_OPEN` | (tắt) | Đặt `1` để tự mở trình duyệt khi server sẵn sàng |

## Dữ liệu lấy từ đâu

Claude Code ghi metadata của mỗi subagent cạnh transcript của session:

```
~/.claude/projects/<project>/<session>.jsonl                        transcript cha
~/.claude/projects/<project>/<session>/subagents/agent-<id>.meta.json
~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl
```

File `.meta.json` chứa đúng thứ cần tìm:

```json
{"agentType":"claude-code-guide","description":"...","toolUseId":"toolu_...","spawnDepth":1}
```

## Trạng thái được suy ra thế nào

Trạng thái đọc từ chính transcript của agent, KHÔNG đọc từ tool result bên transcript cha.
Lý do: agent chạy nền nhận tool result ngay lúc khởi động ("Async agent launched successfully"),
nên transcript cha không thể cho biết lúc nào agent dừng.

Bản ghi cuối của transcript agent nói lên tất cả:

| Bản ghi cuối | Nghĩa |
| --- | --- |
| `user` + `tool_result` | Đang chờ lượt model tiếp theo |
| `assistant` + chỉ `thinking` | Đang giữa một lượt, chưa ghi xong |
| `assistant` + có `tool_use` | Đang gọi tool |
| `assistant` + có `text`, không có `tool_use` | Đã trả lời xong |

| Trạng thái | Điều kiện |
| --- | --- |
| `done` | Bản ghi cuối là assistant có `text` và không có `tool_use`, và file đã lặng quá `AGENT_MONITOR_SETTLE_MS` |
| `running` | Mọi trường hợp còn lại, khi file vẫn còn được ghi gần đây |
| `stale` | Chưa xong nhưng không có hoạt động nào quá `AGENT_MONITOR_STALE_MS` - thường là session bị đóng giữa chừng |

Hai chỗ dễ sai đã kiểm chứng bằng thực nghiệm:

- `stop_reason` KHÔNG dùng được. Bản ghi kết thúc được quan sát thấy mang cả `"end_turn"` lẫn `null`.
- Bản ghi `text`-only cũng xuất hiện GIỮA chừng: model viết một đoạn text mở đầu thành bản ghi riêng
  rồi một lát sau mới ghi tool call. Vì vậy phải chờ file lặng (`settleMs`) trước khi kết luận.

## Hiệu năng

Mỗi lần poll chỉ đọc 256KB cuối của transcript, và chỉ đọc lại khi mtime đổi.
Agent không có hoạt động trong `AGENT_MONITOR_MAX_AGE_MS` bị bỏ qua trước khi parse bất cứ thứ gì.
Kết luận được cache theo mtime nên nếu kết luận sớm bị sai, nó tự sửa ngay khi agent ghi thêm.

## Bảo mật

Server bind vào `127.0.0.1`, không ra ngoài mạng. Nó đọc metadata transcript trong máy nên đừng expose ra internet.
