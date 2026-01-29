import { ref, watch } from 'vue'

const MAX_RECENT_SEARCHES = 10
const STORAGE_KEY = 'recent-song-searches'

const recentSearches = ref<string[]>([])

// Load from localStorage on init
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      recentSearches.value = JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load recent searches:', e)
  }
}

// Initialize
loadFromStorage()

// Save to localStorage on change
watch(
  recentSearches,
  (newSearches) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSearches))
    } catch (e) {
      console.error('Failed to save recent searches:', e)
    }
  },
  { deep: true }
)

export function useRecentSearches() {
  const addSearch = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) return

    // Remove if already exists
    const filtered = recentSearches.value.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())

    // Add to beginning
    recentSearches.value = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES)
  }

  const removeSearch = (query: string) => {
    recentSearches.value = recentSearches.value.filter((s) => s !== query)
  }

  const clearSearches = () => {
    recentSearches.value = []
  }

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearSearches,
  }
}
