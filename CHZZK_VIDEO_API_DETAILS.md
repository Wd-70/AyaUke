# Chzzk Video List API Details

## API Endpoint

**URL Pattern:**
```
https://api.chzzk.naver.com/service/v1/channels/{channelId}/videos
```

**Example:**
```
https://api.chzzk.naver.com/service/v1/channels/abe8aa82baf3d3ef54ad8468ee73e7fc/videos?sortType=LATEST&pagingType=PAGE&page=0&size=24&publishDateAt=&videoType=
```

## Request Details

### Method
`GET`

### Query Parameters

| Parameter | Example Value | Description |
|-----------|--------------|-------------|
| `sortType` | `LATEST` | Sort order for videos (LATEST, POPULAR, etc.) |
| `pagingType` | `PAGE` | Pagination type |
| `page` | `0` | Page number (0-indexed) |
| `size` | `24` | Number of videos per page |
| `publishDateAt` | (empty) | Filter by publish date (optional) |
| `videoType` | (empty) | Filter by video type (optional, e.g., REPLAY, UPLOAD) |

### Required Request Headers

```json
{
  "accept": "application/json, text/plain, */*",
  "referer": "https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc",
  "front-client-platform-type": "PC",
  "front-client-product-type": "web",
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
}
```

### Optional Headers (but recommended)

```json
{
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "if-modified-since": "Mon, 26 Jul 1997 05:00:00 GMT",
  "deviceid": "86572490-1db1-452b-a3ff-f7bc49b17788"
}
```

## Response Structure

### Response Headers

```json
{
  "content-type": "application/json",
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "access-control-allow-origin": "https://chzzk.naver.com",
  "server": "nfront"
}
```

### Response Body Structure

```json
{
  "code": 200,
  "message": null,
  "content": {
    "page": 0,
    "size": 24,
    "totalCount": 45,
    "totalPages": 2,
    "data": [
      {
        "videoNo": 11162022,
        "videoId": "1529F9C119E284F3B17CAC57BBD3DF22A642",
        "videoTitle": "라인ck 같이보기 + 케리아 선수를 잇는 미드 조이",
        "videoType": "REPLAY",
        "publishDate": "2026-01-10 01:21:19",
        "thumbnailImageUrl": "https://livecloud-thumb.akamaized.net/chzzk/kr/live-rewind-image/record/48985334/represent/thumbnail/image_16618640_720_2.jpg",
        "trailerUrl": null,
        "duration": 25878,
        "readCount": 826,
        "publishDateAt": 1767975678792,
        "categoryType": "GAME",
        "videoCategory": "League_of_Legends",
        "videoCategoryValue": "리그 오브 레전드",
        "exposure": false,
        "adult": false,
        "clipActive": true,
        "livePv": 15992,
        "tags": ["버튜버", "허니즈", "프로젝트아이", "리그오브레전드", "롤"],
        "commentActive": true,
        "channel": {
          "channelId": "abe8aa82baf3d3ef54ad8468ee73e7fc",
          "channelName": "아야 AyaUke",
          "channelImageUrl": "https://nng-phinf.pstatic.net/...",
          "verifiedMark": false,
          "activatedChannelBadgeIds": []
        },
        "blindType": null,
        "watchTimeline": null,
        "paidProductId": null,
        "tvAppViewingPolicyType": "ALLOWED"
      }
      // ... more videos
    ]
  }
}
```

## Video Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `videoNo` | number | Internal video number |
| `videoId` | string | Unique video ID (use for playback) |
| `videoTitle` | string | Video title |
| `videoType` | string | Type: "REPLAY" (VOD from live stream) or "UPLOAD" (uploaded video) |
| `publishDate` | string | Publication date (format: "YYYY-MM-DD HH:mm:ss") |
| `publishDateAt` | number | Timestamp in milliseconds |
| `thumbnailImageUrl` | string | Thumbnail image URL |
| `trailerUrl` | string/null | Trailer video URL (if available) |
| `duration` | number | Video duration in seconds |
| `readCount` | number | View count |
| `livePv` | number | Live viewer count (for REPLAY type) |
| `categoryType` | string | Category type (e.g., "GAME", "ETC") |
| `videoCategory` | string | Specific category ID |
| `videoCategoryValue` | string | Category display name (Korean) |
| `exposure` | boolean | Whether video is publicly exposed |
| `adult` | boolean | Adult content flag |
| `clipActive` | boolean | Whether clipping is enabled |
| `tags` | string[] | Video tags |
| `commentActive` | boolean | Whether comments are enabled |
| `blindType` | string/null | Content blocking type |
| `paidProductId` | string/null | Paid product ID (for premium content) |
| `tvAppViewingPolicyType` | string | TV app viewing policy |

## Channel Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `channelId` | string | Channel unique ID |
| `channelName` | string | Channel display name |
| `channelImageUrl` | string | Channel profile image URL |
| `verifiedMark` | boolean | Verified channel status |
| `activatedChannelBadgeIds` | array | Active channel badges |

## Pagination

- Use `page` parameter to navigate pages (0-indexed)
- `totalPages` indicates total number of pages
- `totalCount` shows total number of videos
- Default `size` is 24 videos per page
- **IMPORTANT: Maximum `size` is 50**. Values above 50 will result in 400 Bad Request error

## Video Types

1. **REPLAY**: VOD automatically created from live streams
2. **UPLOAD**: Videos manually uploaded by the channel

## Notes

- The API requires proper headers including `front-client-platform-type` and `front-client-product-type`
- A `deviceid` header is generated on the client side (appears to be a UUID)
- The `referer` header should point to the channel page
- Response is always wrapped in `{code, message, content}` structure
- Timestamps are in milliseconds (epoch time)
- Thumbnail URLs are hosted on Akamai CDN
- Video playback URLs are not included in this list endpoint (need separate API call with videoId)

## Sample cURL Request

```bash
curl 'https://api.chzzk.naver.com/service/v1/channels/abe8aa82baf3d3ef54ad8468ee73e7fc/videos?sortType=LATEST&pagingType=PAGE&page=0&size=24&publishDateAt=&videoType=' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'referer: https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc' \
  -H 'front-client-platform-type: PC' \
  -H 'front-client-product-type: web' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
```

## Related API Endpoints

Based on network inspection, other related endpoints include:

- `/service/v1/channels/{channelId}` - Get channel information
- `/service/v1/channels/{channelId}/data` - Get channel data (banners, top videos)
- `/service/v1/channels/{channelId}/clips` - Get channel clips

