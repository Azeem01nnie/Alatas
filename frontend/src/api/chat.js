import {
  fetchChatMessages,
  sendChatMessage,
  fetchChatThreads,
  setChatThreadArchivedRemote,
  deleteChatThreadRemote,
} from './backend'
import {
  fetchCloudChatMessages,
  sendCloudChatMessage,
  fetchCloudChatThreads,
  setCloudChatThreadArchived,
  deleteCloudChatThread,
  isCloudConfigured,
  CLOUD_SYNC_ENABLED,
} from './cloudSync'

function preferCloudDirect() {
  return CLOUD_SYNC_ENABLED && isCloudConfigured()
}

export async function listChatMessages(options) {
  try {
    return await fetchChatMessages(options)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return fetchCloudChatMessages(options)
  }
}

export async function postChatMessage(payload) {
  try {
    return await sendChatMessage(payload)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return sendCloudChatMessage(payload)
  }
}

export async function listChatThreads({ archived = false } = {}) {
  try {
    return await fetchChatThreads({ archived })
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return fetchCloudChatThreads({ archived })
  }
}

export async function setChatThreadArchived(threadId, archived) {
  try {
    return await setChatThreadArchivedRemote(threadId, archived)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return setCloudChatThreadArchived(threadId, archived)
  }
}

export async function deleteChatConversation(threadId) {
  try {
    return await deleteChatThreadRemote(threadId)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return deleteCloudChatThread(threadId)
  }
}
