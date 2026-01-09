# Platform API Documentation

**Version:** 1.0 **Base URL:** `/api/v1` **Last Updated:** 2025-12-03

## Table of Contents

- [Authentication](#authentication)
- [REST API](#rest-api)
  - [Posts](#posts)
  - [Groups & Missions](#groups--missions)
  - [Propositions](#propositions)
  - [Interactions](#interactions)
- [Agent Tools](#agent-tools)
  - [Posts & Tasks Tools](#posts--tasks-tools)
  - [Missions & Groups Tools](#missions--groups-tools)
  - [Propositions Tools](#propositions-tools)
  - [Wiki Tools](#wiki-tools)
  - [Interaction Tools](#interaction-tools)
  - [Introspection Tools](#introspection-tools)
- [Error Handling](#error-handling)

---

## Authentication

All API endpoints require authentication via Bearer token.

**Header:**

```http
Authorization: Bearer <your_access_token>
```

The token is obtained through Supabase authentication. All operations respect Row Level Security
(RLS) policies.

---

## REST API

### Posts

#### List Posts

```http
GET /api/v1/posts?type=post&groupId=<group_id>&limit=10
```

**Query Parameters:**

- `type` (optional) - Filter by type: `post`, `task`, etc.
- `groupId` (optional) - Filter by group ID
- `limit` (optional) - Max results (default: 10)

**Response:**

```json
[
  {
    "id": "uuid",
    "title": "Post Title",
    "content": "Post content...",
    "author_id": "uuid",
    "created_at": "2025-12-03T10:00:00Z",
    "metadata": {
      "type": "post",
      "groupId": "uuid",
      "tags": ["tag1", "tag2"]
    },
    "author": {
      "display_name": "John Doe"
    }
  }
]
```

#### Create Post

```http
POST /api/v1/posts
```

**Request Body:**

```json
{
  "title": "My Post",
  "content": "This is the content",
  "type": "post",
  "groupId": "uuid",
  "tags": ["announcement", "urgent"]
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "title": "My Post",
  "content": "This is the content",
  "author_id": "uuid",
  "metadata": {
    "type": "post",
    "groupId": "uuid",
    "tags": ["announcement", "urgent"],
    "source": "api"
  }
}
```

#### Update Post

```http
PUT /api/v1/posts/:id
```

**Request Body:**

```json
{
  "title": "Updated Title",
  "content": "Updated content"
}
```

**Response:** `200 OK`

---

### Groups & Missions

#### List Groups

```http
GET /api/v1/groups?type=mission&limit=10
```

**Query Parameters:**

- `type` (optional) - Filter by type: `group`, `mission`
- `limit` (optional) - Max results (default: 10)

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Mission Name",
    "description": "Mission description",
    "created_by": "uuid",
    "metadata": {
      "type": "mission",
      "location": "City Center",
      "status": "active"
    }
  }
]
```

#### Create Group/Mission

```http
POST /api/v1/groups
```

**Request Body:**

```json
{
  "name": "New Mission",
  "description": "Help organize community event",
  "type": "mission",
  "location": "City Center"
}
```

**Response:** `201 Created` _Note: Creator is automatically added as admin_

#### Update Group

```http
PUT /api/v1/groups/:id
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "location": "New Location",
  "status": "completed"
}
```

#### Join Group

```http
POST /api/v1/groups/:id/join
```

**Response:** `200 OK`

```json
{
  "success": true
}
```

#### Leave Group

```http
POST /api/v1/groups/:id/leave
```

**Response:** `200 OK`

```json
{
  "success": true
}
```

---

### Propositions

#### List Propositions

```http
GET /api/v1/propositions?status=active&limit=10
```

**Query Parameters:**

- `status` (optional) - Filter by status: `active`, `closed`, `draft` (default: active)
- `limit` (optional) - Max results (default: 10)

**Response:**

```json
[
  {
    "id": "uuid",
    "title": "Proposition Title",
    "description": "Proposition description",
    "status": "active",
    "author_id": "uuid",
    "created_at": "2025-12-03T10:00:00Z",
    "author": {
      "display_name": "John Doe"
    }
  }
]
```

#### Create Proposition

```http
POST /api/v1/propositions
```

**Request Body:**

```json
{
  "title": "New Park Proposal",
  "description": "We should create a new park in the city center",
  "tags": ["urbanisme", "environment"]
}
```

**Response:** `201 Created`

#### Update Proposition

```http
PUT /api/v1/propositions/:id
```

**Request Body:**

```json
{
  "status": "closed",
  "title": "Updated Title"
}
```

**Response:** `200 OK`

---

### Interactions

#### Vote on Proposition

```http
POST /api/v1/votes
```

**Request Body:**

```json
{
  "proposition_id": "uuid",
  "value": 1
}
```

**Values:**

- `1` - Vote FOR
- `-1` - Vote AGAINST
- `0` - Remove vote

**Response:** `200 OK`

```json
{
  "success": true
}
```

#### Add Reaction

```http
POST /api/v1/reactions
```

**Request Body:**

```json
{
  "post_id": "uuid",
  "emoji": "👍"
}
```

**Response:** `200 OK`

#### Add Comment

```http
POST /api/v1/comments
```

**Request Body:**

```json
{
  "post_id": "uuid",
  "content": "Great post!"
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "post_id": "uuid",
  "user_id": "uuid",
  "content": "Great post!",
  "created_at": "2025-12-03T10:00:00Z"
}
```

---

## Agent Tools

The Bob AI Agent has access to these tools for natural language interaction.

### Posts & Tasks Tools

#### `create_post`

**Description:** Publish a new message, announcement, or thought.

**Parameters:**

- `content` (required) - Post content (Markdown supported)
- `title` (optional) - Post title
- `group_id` (optional) - Group ID to post in
- `tags` (optional) - Array of tags

**Example:**

```
"Create a post announcing the community meeting tomorrow at 6pm"
```

**Agent Response:**

```
✅ Post créé avec succès ! (ID: abc-123)
```

#### `update_post`

**Description:** Modify an existing post.

**Parameters:**

- `id` (required) - Post ID
- `content` (optional) - New content
- `title` (optional) - New title

#### `list_posts`

**Description:** List recent posts with filters.

**Parameters:**

- `group_id` (optional) - Filter by group
- `limit` (optional) - Max results (default: 10)
- `query` (optional) - Text search in content

**Example:**

```
"Show me the last 5 posts in this group"
```

#### `create_task`

**Description:** Create a new task in a project or group.

**Parameters:**

- `title` (required) - Task title
- `description` (optional) - Detailed description
- `project_id` (optional) - Project/group ID (defaults to current context)
- `status` (optional) - Initial status: `todo`, `in_progress`, `done`, `blocked`
- `priority` (optional) - Priority: `low`, `medium`, `high`
- `assignee_id` (optional) - User ID to assign

**Example:**

```
"Create a task to organize the next meeting"
```

**Agent Response:**

```
✅ Tâche "Organize next meeting" créée ! (ID: xyz-789)
```

#### `update_task`

**Description:** Update a task (status, assignation, details).

**Parameters:**

- `id` (required) - Task ID
- `status` (optional) - New status
- `title` (optional) - New title
- `description` (optional) - New description
- `priority` (optional) - New priority

**Example:**

```
"Mark task xyz-789 as done"
```

#### `list_tasks`

**Description:** List tasks with filters.

**Parameters:**

- `project_id` (optional) - Filter by project
- `status` (optional) - Filter by status
- `assignee_id` (optional) - Filter by assignee (`me` for current user)
- `limit` (optional) - Max results (default: 20)

**Example:**

```
"Show me all my tasks that are in progress"
```

---

### Missions & Groups Tools

#### `create_mission`

**Description:** Create a new mission (action group).

**Parameters:**

- `name` (required) - Mission name
- `description` (optional) - Mission objective
- `location` (optional) - Location

**Example:**

```
"Create a mission to clean up the park this Saturday"
```

#### `update_mission`

**Description:** Update mission details.

**Parameters:**

- `id` (required) - Mission ID
- `name` (optional)
- `description` (optional)
- `location` (optional)
- `status` (optional) - `active`, `completed`, `archived`

#### `list_missions`

**Description:** List available missions.

**Parameters:**

- `query` (optional) - Search by name
- `limit` (optional) - Max results (default: 10)

**Example:**

```
"What missions are available?"
```

#### `join_group`

**Description:** Join a group or mission.

**Parameters:**

- `group_id` (required) - Group ID to join

**Example:**

```
"I want to join the park cleanup mission"
```

#### `leave_group`

**Description:** Leave a group or mission.

**Parameters:**

- `group_id` (required) - Group ID to leave

#### `list_my_groups`

**Description:** List groups the user is a member of.

**Example:**

```
"What groups am I in?"
```

---

### Propositions Tools

#### `create_proposition`

**Description:** Create a proposition for voting.

**Parameters:**

- `title` (required) - Proposition title
- `description` (optional) - Detailed description
- `tags` (optional) - Associated tags (e.g., ['urbanisme', 'budget'])

**Example:**

```
"Create a proposition to add bike lanes on Main Street"
```

#### `update_proposition`

**Description:** Update proposition details.

**Parameters:**

- `id` (required) - Proposition ID
- `status` (optional) - `active`, `closed`, `draft`
- `title` (optional)

#### `list_propositions`

**Description:** List propositions.

**Parameters:**

- `status` (optional) - Filter by status (default: active)
- `tag` (optional) - Filter by tag
- `limit` (optional) - Max results (default: 10)

**Example:**

```
"Show me all active propositions about urbanisme"
```

#### `vote_proposition`

**Description:** Vote for or against a proposition.

**Parameters:**

- `proposition_id` (required) - Proposition ID
- `value` (required) - `1` (For), `-1` (Against), `0` (Neutral/Remove)

**Example:**

```
"I want to vote for the bike lanes proposition"
```

---

### Wiki Tools

#### `create_wiki_page`

**Description:** Create a new wiki page.

**Parameters:**

- `title` (required) - Page title
- `content` (required) - Page content (Markdown)
- `summary` (optional) - Short summary

**Example:**

```
"Create a wiki page about community guidelines"
```

#### `update_wiki_page`

**Description:** Update wiki page content.

**Parameters:**

- `id` (required) - Page ID
- `content` (optional) - New content
- `summary` (optional) - New summary

#### `get_wiki_page`

**Description:** Retrieve wiki page content.

**Parameters:**

- `id` (optional) - Page ID
- `title` (optional) - Page title

**Example:**

```
"Show me the community guidelines wiki page"
```

---

### Interaction Tools

#### `add_reaction`

**Description:** Add an emoji reaction to a post.

**Parameters:**

- `post_id` (required) - Post ID
- `emoji` (required) - Emoji (e.g., '👍', '❤️')

**Example:**

```
"Add a heart reaction to that post"
```

#### `create_comment`

**Description:** Add a comment to a post.

**Parameters:**

- `post_id` (required) - Post ID
- `content` (required) - Comment content

**Example:**

```
"Add a comment saying I agree with this proposal"
```

---

### Introspection Tools

#### `get_schema_info`

**Description:** Get database schema information.

**Parameters:**

- `table` (optional) - Specific table name

**Example:**

```
"What fields are in the posts table?"
```

**Agent Response:**

```
Table posts: id, content, title, author_id, metadata (type, groupId, tags, status, priority, assigneeId)
```

#### `get_user_context`

**Description:** Get current user information and navigation context.

**Example:**

```
"What is my current context?"
```

**Agent Response:**

```json
{
  "user": {
    "id": "abc-123",
    "email": "user@example.com"
  },
  "context": {
    "url": "https://example.com/groups/xyz",
    "pathname": "/groups/xyz",
    "groupId": "xyz"
  }
}
```

#### `list_capabilities`

**Description:** List all available agent tools.

**Example:**

```
"What can you do?"
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": "Error message description"
}
```

### Common Errors

**Unauthorized:**

```json
{
  "error": "Unauthorized"
}
```

**Missing Authorization:**

```json
{
  "error": "Missing Authorization header"
}
```

**Database Error:**

```json
{
  "error": "Database error message"
}
```

---

## Context Awareness

The Agent is context-aware and can infer parameters from the user's current location:

- **Current Group:** If the user is on a group page, `groupId` is automatically inferred for posts
  and tasks
- **Current User:** The agent always acts on behalf of the authenticated user
- **URL Context:** The agent receives the full URL and can extract relevant IDs

**Example:** When on `/groups/abc-123`, asking:

```
"Create a task to prepare the agenda"
```

The agent automatically associates the task with group `abc-123`.

---

## Rate Limiting

Currently, there are no explicit rate limits. However, standard Netlify Edge Function limits apply:

- 50ms CPU time per request
- 10MB response size limit

---

## Support

For issues or questions:

- Check the [Implementation Plan](../implementation_plan.md)
- Review the [Walkthrough](../walkthrough.md)
- Contact the development team
