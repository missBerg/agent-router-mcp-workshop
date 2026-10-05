// chat: the team chat - channels, messages, people and reminders.
import { z } from "zod";
import { paging, tool, type ToolDef } from "../tool.ts";
import { PEOPLE, world } from "../world.ts";

const channel = z.string().describe("Channel name, with or without '#', e.g. '#releases'.");
const messageId = z.string().describe("Message id, e.g. 'msg-101'.");
const user = z.string().describe("User login, e.g. 'priya'.");

/** Accepts '#releases', 'releases' or 'Releases'; throws a helpful error for unknown channels. */
function channelKey(name: string): string {
  const key = name.trim().replace(/^#/, "").toLowerCase();
  if (!(key in world.channels)) {
    throw new Error(`Unknown channel '${name}'. Available channels: ${Object.keys(world.channels).map((c) => `#${c}`).join(", ")}.`);
  }
  return key;
}

export const chat: ToolDef[] = [
  // --- the tool the ship-it job needs ---
  tool("post_message", "Posts a message to a channel as the calling bot. Supports Markdown formatting and @-mentions. Returns the message id and a permalink.",
    { channel, text: z.string().min(1).describe("Message text in Markdown.") },
    {
      run: ({ channel, text }, caller) => {
        const key = channelKey(channel);
        const message = { id: `msg-${world.seq.message++}`, user: caller.agentId ?? "ship-it-bot", text, ts: new Date().toISOString() };
        world.channels[key].push(message);
        return { ok: true, id: message.id, channel: `#${key}`, permalink: `https://chat.lakeshore.dev/archives/${key}/${message.id}` };
      },
    }),

  // --- messages ---
  tool("send_message", "Sends a direct message to one or more users (not to a channel). To post in a channel, use post_message.",
    { users: z.array(z.string()).min(1).describe("Logins of the recipients."), text: z.string().describe("Message text in Markdown.") }),
  tool("post_announcement", "Posts an announcement to #announcements and notifies the whole company with @channel. Use sparingly.",
    { text: z.string().describe("Announcement text in Markdown."), title: z.string().optional().describe("Bold title shown above the text.") }),
  tool("reply_in_thread", "Replies in the thread of an existing message.",
    { channel, thread_id: messageId.describe("Id of the message that starts the thread."), text: z.string().describe("Reply text in Markdown."), broadcast: z.boolean().optional().describe("Also show the reply in the channel.") }),
  tool("update_message", "Edits the text of a message previously posted by the calling bot.",
    { channel, message_id: messageId, text: z.string().describe("New message text.") }),
  tool("delete_message", "Permanently deletes a message and its entire thread for everyone in the channel. This cannot be undone.",
    { channel, message_id: messageId },
    { danger: "Message {message_id} and its 214-reply thread deleted from {channel}. That was the only record of last quarter's incident decisions." }),
  tool("schedule_message", "Schedules a message to be posted to a channel at a later time.",
    { channel, text: z.string().describe("Message text."), post_at: z.string().describe("When to post, in ISO 8601.") }),
  tool("list_scheduled_messages", "Lists messages scheduled by the calling bot that have not been posted yet.", { channel: channel.optional() }),
  tool("delete_scheduled_message", "Cancels a scheduled message before it is posted.", { scheduled_message_id: z.string().describe("Scheduled message id.") }),
  tool("get_channel_history", "Gets the most recent messages in a channel, oldest first.",
    { channel, limit: z.number().int().min(1).max(200).optional().describe("Maximum number of messages. Defaults to 20.") },
    { run: ({ channel, limit = 20 }) => world.channels[channelKey(channel)].slice(-limit) }),
  tool("search_messages", "Searches messages across all channels the bot can read. Supports 'in:#channel' and 'from:@user' filters.",
    { query: z.string().describe("Search query, e.g. 'postal code in:#checkout-team'."), ...paging }),
  tool("get_permalink", "Gets a shareable permalink for a message.", { channel, message_id: messageId }),
  tool("add_reaction", "Adds an emoji reaction to a message.",
    { channel, message_id: messageId, emoji: z.string().describe("Emoji name without colons, e.g. 'white_check_mark'.") }),
  tool("remove_reaction", "Removes an emoji reaction the bot added to a message.",
    { channel, message_id: messageId, emoji: z.string().describe("Emoji name without colons.") }),
  tool("pin_message", "Pins a message to a channel so it is easy to find.", { channel, message_id: messageId }),
  tool("unpin_message", "Unpins a message from a channel.", { channel, message_id: messageId }),
  tool("list_pinned_messages", "Lists the pinned messages in a channel.", { channel }),
  tool("mark_as_read", "Marks a channel as read up to a given message.", { channel, message_id: messageId.optional() }),
  tool("list_mentions", "Lists recent messages that @-mention the calling bot.", { ...paging }),

  // --- channels ---
  tool("list_channels", "Lists the channels the bot can see, with topic and member count.",
    { include_archived: z.boolean().optional().describe("Include archived channels.") },
    { run: () => Object.entries(world.channels).map(([name, messages]) => ({ name: `#${name}`, messages: messages.length })) }),
  tool("get_channel", "Gets a channel's topic, purpose, creation date and member count.", { channel },
    { run: ({ channel }) => { const key = channelKey(channel); return { name: `#${key}`, messages: world.channels[key].length }; } }),
  tool("create_channel", "Creates a new public or private channel.",
    { name: z.string().describe("Channel name without '#', lowercase with dashes."), private: z.boolean().optional().describe("Create a private channel."), topic: z.string().optional().describe("Initial channel topic.") }),
  tool("archive_channel", "Archives a channel: it becomes read-only, is removed from everyone's sidebar, and its integrations stop posting.",
    { channel },
    { danger: "Channel {channel} archived. Alerts, deploy notifications and 40 colleagues just lost their home." }),
  tool("rename_channel", "Renames a channel. Existing links keep working.", { channel, new_name: z.string().describe("New channel name without '#'.") }),
  tool("set_channel_topic", "Sets the topic shown at the top of a channel.", { channel, topic: z.string().describe("New topic.") }),
  tool("invite_to_channel", "Invites one or more users to a channel.",
    { channel, users: z.array(z.string()).min(1).describe("Logins to invite.") }),
  tool("remove_from_channel", "Removes a user from a channel.", { channel, user }),
  tool("join_channel", "Joins a public channel as the calling bot.", { channel }),
  tool("leave_channel", "Leaves a channel as the calling bot.", { channel }),
  tool("list_channel_members", "Lists the members of a channel.", { channel, ...paging }),

  // --- people ---
  tool("list_users", "Lists people in the workspace with their display names and titles.", { ...paging }, { run: () => PEOPLE }),
  tool("get_user_profile", "Gets a user's profile: display name, title, timezone and status.", { user }),
  tool("set_user_status", "Sets the calling bot's status text and emoji.",
    { text: z.string().describe("Status text."), emoji: z.string().optional().describe("Status emoji name."), expires_in_minutes: z.number().int().optional().describe("Clear the status after this many minutes.") }),
  tool("get_user_presence", "Gets whether a user is currently active or away.", { user }),
  tool("create_user_group", "Creates a user group that can be @-mentioned, such as @checkout-oncall.",
    { handle: z.string().describe("Group handle without '@'."), name: z.string().describe("Display name."), users: z.array(z.string()).optional().describe("Initial members.") }),
  tool("list_user_groups", "Lists user groups and their members.", { ...paging }),
  tool("add_to_user_group", "Adds users to a user group.", { handle: z.string().describe("Group handle without '@'."), users: z.array(z.string()).min(1).describe("Logins to add.") }),

  // --- files, reminders, calls, emoji ---
  tool("upload_file", "Uploads a file or code snippet and shares it in a channel.",
    { channel, filename: z.string().describe("File name, e.g. 'deploy.log'."), content: z.string().describe("File content."), title: z.string().optional().describe("Title shown in the channel.") }),
  tool("list_files", "Lists files shared in a channel or by a user.", { channel: channel.optional(), user: user.optional(), ...paging }),
  tool("get_file", "Gets a shared file's metadata and a download URL.", { file_id: z.string().describe("File id.") }),
  tool("create_reminder", "Creates a reminder for a user or channel.",
    { text: z.string().describe("What to be reminded about."), time: z.string().describe("When, as ISO 8601 or natural language such as 'in 2 hours'."), channel: channel.optional() }),
  tool("list_reminders", "Lists reminders created by the calling bot.", {}),
  tool("start_call", "Starts an audio call (huddle) in a channel and posts a join link.", { channel, topic: z.string().optional().describe("Call topic.") }),
  tool("list_custom_emoji", "Lists custom emoji in the workspace.", { ...paging }),
];
