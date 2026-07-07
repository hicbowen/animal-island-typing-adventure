package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var wordsFile = "words.json"
var wordList []WordEntry

var symbolsFile = "symbols.txt"
var symbolList []string
var rng = rand.New(rand.NewSource(time.Now().UnixNano()))

const dataFile = "players.json"

var (
	playerList []Player
	mu         sync.Mutex
	rngMu      sync.Mutex
)

type Player struct {
	UUID  string `json:"uuid"`
	Name  string `json:"name"`
	Score int    `json:"score"`
}

type WordEntry struct {
	Word        string `json:"word"`
	Explanation string `json:"explanation"`
}

func loadPlayers() {
	file, err := os.ReadFile(dataFile)
	if err != nil {
		if os.IsNotExist(err) {
			playerList = []Player{}
			return
		}
		log.Fatalf("Failed to read data file: %v", err)
	}

	err = json.Unmarshal(file, &playerList)
	if err != nil {
		log.Fatalf("Failed to parse JSON: %v", err)
	}
	log.Printf("Loaded %d players from %s\n", len(playerList), dataFile)
}

func savePlayers() {
	data, err := json.MarshalIndent(playerList, "", "  ")
	if err != nil {
		log.Printf("Failed to encode player list: %v", err)
		return
	}

	err = os.WriteFile(dataFile, data, 0644)
	if err != nil {
		log.Printf("Failed to write file: %v", err)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("Failed to write JSON response: %v", err)
	}
}

func validPlayer(p Player) bool {
	return strings.TrimSpace(p.UUID) != "" &&
		strings.TrimSpace(p.Name) != "" &&
		p.Score >= 0
}

func handleScore(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var p Player
		err := json.NewDecoder(r.Body).Decode(&p)
		if err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		p.UUID = strings.TrimSpace(p.UUID)
		p.Name = strings.TrimSpace(p.Name)
		if !validPlayer(p) {
			http.Error(w, "UUID, name and non-negative score are required", http.StatusBadRequest)
			return
		}

		mu.Lock()
		defer mu.Unlock()

		updated := false
		for i, existing := range playerList {
			if existing.UUID == p.UUID {
				// 如果新分数更高，更新
				if p.Score > existing.Score {
					playerList[i].Score = p.Score
					playerList[i].Name = p.Name // 可选：也更新 name
				}
				updated = true
				break
			}
		}

		if !updated {
			// 是新玩家，追加
			playerList = append(playerList, p)
		}

		savePlayers()

		log.Printf("Score saved for UUID %s (%s), score = %d", p.UUID, p.Name, p.Score)

		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"msg":    fmt.Sprintf("Score received for %s", p.Name),
		})

	case http.MethodGet:
		mu.Lock()
		playersCopy := make([]Player, len(playerList))
		copy(playersCopy, playerList)
		mu.Unlock()

		sort.Slice(playersCopy, func(i, j int) bool {
			return playersCopy[i].Score > playersCopy[j].Score
		})

		writeJSON(w, http.StatusOK, playersCopy)

	default:
		http.Error(w, "Only GET and POST allowed", http.StatusMethodNotAllowed)
	}
}

func getRandomItems[T any](items []T, n int) []T {
	if len(items) == 0 || n <= 0 {
		return []T{}
	}

	rngMu.Lock()
	defer rngMu.Unlock()

	if n >= len(items) {
		shuffled := make([]T, len(items))
		copy(shuffled, items)
		rng.Shuffle(len(shuffled), func(i, j int) {
			shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
		})
		return shuffled
	}

	indices := rng.Perm(len(items))[:n]
	result := make([]T, n)
	for i, idx := range indices {
		result[i] = items[idx]
	}
	return result
}

func getRandomWords(n int) []WordEntry {
	return getRandomItems(wordList, n)
}

func getRandomSymbols(n int) []string {
	return getRandomItems(symbolList, n)
}

func clampNum(raw string, defaultValue int, minValue int, maxValue int) int {
	num, err := strconv.Atoi(raw)
	if err != nil {
		return defaultValue
	}
	if num < minValue {
		return minValue
	}
	if num > maxValue {
		return maxValue
	}
	return num
}

func loadLines(path string) ([]string, error) {
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	lines := []string{}
	for _, line := range strings.Split(string(file), "\n") {
		item := strings.TrimSpace(line)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		lines = append(lines, item)
	}

	return lines, nil
}

func loadWords(path string) ([]WordEntry, error) {
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var entries []WordEntry
	if err := json.Unmarshal(file, &entries); err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	words := []WordEntry{}
	for _, entry := range entries {
		word := strings.TrimSpace(entry.Word)
		explanation := strings.TrimSpace(entry.Explanation)
		if word == "" || seen[word] {
			continue
		}
		seen[word] = true
		words = append(words, WordEntry{
			Word:        word,
			Explanation: explanation,
		})
	}

	return words, nil
}

func wordsHandler(w http.ResponseWriter, r *http.Request) {
	num := clampNum(r.URL.Query().Get("num"), 10, 1, 60)
	words := getRandomWords(num)

	writeJSON(w, http.StatusOK, words)
}

func symbolsHandler(w http.ResponseWriter, r *http.Request) {
	symbols := getRandomSymbols(20)
	writeJSON(w, http.StatusOK, symbols)
}

func main() {
	words, err := loadWords(wordsFile)
	if err != nil {
		log.Fatalf("Failed to load words: %v", err)
	}
	symbols, err := loadLines(symbolsFile)
	if err != nil {
		log.Fatalf("Failed to load symbols: %v", err)
	}
	wordList = words
	symbolList = symbols
	loadPlayers()
	http.HandleFunc("/words", wordsHandler)
	http.HandleFunc("/symbols", symbolsHandler)
	http.HandleFunc("/score", handleScore)
	port := ":8087"
	log.Fatal(http.ListenAndServe(port, nil))
}
