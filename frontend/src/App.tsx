import { useEffect, useMemo, useRef, useState } from "react";
import {
    Avatar,
    Button,
    Collapse,
    CountUp,
    Drawer,
    Input,
    Modal,
    NoData,
    Notification,
    Progress,
    Skeleton,
    Table,
    Tabs,
    Tag,
    Title,
    Tooltip,
    type TableColumn,
    type TabItem,
} from "animal-island-ui";
import { MapIcon, ScoreboardIcon, StarIcon, TrophyIcon } from "naive-icons";
import { v4 as uuidv4 } from "uuid";

type ChallengeMode = "beach" | "forest" | "volcano" | "symbols";
type ChallengeStatus = "loading" | "ready" | "empty" | "error";
type LeaderboardStatus = "idle" | "loading" | "ready" | "error";

interface Player extends Record<string, unknown> {
    uuid: string;
    name: string;
    score: number;
}

interface PromptItem {
    word: string;
    explanation?: string;
}

interface Challenge {
    key: ChallengeMode;
    label: string;
    title: string;
    count: number;
    kind: "words" | "symbols";
    color: "app-teal" | "app-green" | "app-orange" | "app-yellow";
    helper: string;
}

const challenges: Challenge[] = [
    {
        key: "beach",
        label: "海滩练习",
        title: "海滩捡贝壳",
        count: 15,
        kind: "words",
        color: "app-teal",
        helper: "慢慢打准每个小单词，按空格收进贝壳篮。",
    },
    {
        key: "forest",
        label: "森林挑战",
        title: "森林寻宝路",
        count: 30,
        kind: "words",
        color: "app-green",
        helper: "连续输入更多单词，看看能找到多少星星。",
    },
    {
        key: "volcano",
        label: "火山大师",
        title: "火山勇者关",
        count: 50,
        kind: "words",
        color: "app-orange",
        helper: "大师关词更多，稳住节奏就能拿高分。",
    },
    {
        key: "symbols",
        label: "符号宝藏",
        title: "符号宝藏洞",
        count: 20,
        kind: "symbols",
        color: "app-yellow",
        helper: "挑战键盘上的小符号，注意大小写和位置。",
    },
];

const emptyPlayer = (): Player => ({
    uuid: uuidv4(),
    name: "",
    score: 0,
});

const formatPlayerName = (value: unknown, maxLength = 10) => {
    const name = String(value || "神秘小朋友").trim() || "神秘小朋友";
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;
};

const safeJson = async <T,>(response: Response): Promise<T> => {
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
};

export default function App() {
    const [mode, setMode] = useState<ChallengeMode>("beach");
    const [words, setWords] = useState<PromptItem[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [submittedWords, setSubmittedWords] = useState<string[]>([]);
    const [hasInputError, setHasInputError] = useState(false);
    const [challengeStatus, setChallengeStatus] = useState<ChallengeStatus>("loading");
    const [player, setPlayer] = useState<Player>(emptyPlayer);
    const [nameInput, setNameInput] = useState("");
    const [roundScore, setRoundScore] = useState(0);
    const [resultOpen, setResultOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [leaderboardOpen, setLeaderboardOpen] = useState(false);
    const [leaderboard, setLeaderboard] = useState<Player[]>([]);
    const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>("idle");
    const challengeRequestId = useRef(0);
    const leaderboardRequestId = useRef(0);

    const activeChallenge = useMemo(
        () => challenges.find((challenge) => challenge.key === mode) ?? challenges[0],
        [mode],
    );
    const currentWordIndex = submittedWords.length;
    const currentWord = challengeStatus === "ready" ? words[currentWordIndex]?.word ?? "" : "";
    const progressPercent = words.length ? (submittedWords.length / words.length) * 100 : 0;
    const liveScore = submittedWords.filter((word, index) => word === words[index]?.word).length;
    const totalAfterRound = player.score + roundScore;
    const challengeHasError = challengeStatus === "error" || hasInputError;
    const challengeHint = challengeStatus === "loading"
        ? "正在准备"
        : challengeStatus === "error"
            ? "连接失败"
            : challengeStatus === "empty"
                ? "暂无词语"
                : hasInputError ? "有个字母跑偏了" : "准备出发";

    const fetchLeaderboard = async () => {
        const requestId = ++leaderboardRequestId.current;
        setLeaderboardStatus("loading");
        try {
            const data = await fetch("/api/score").then((response) => safeJson<Player[]>(response));
            if (requestId !== leaderboardRequestId.current) return;
            setLeaderboard(data);
            setLeaderboardStatus("ready");
        } catch (error) {
            if (requestId !== leaderboardRequestId.current) return;
            console.error("Failed to fetch leaderboard:", error);
            setLeaderboardStatus("error");
        }
    };

    const fetchChallenge = async (challenge: Challenge) => {
        const requestId = ++challengeRequestId.current;
        setChallengeStatus("loading");
        setWords([]);
        setInputValue("");
        setSubmittedWords([]);
        setHasInputError(false);
        setRoundScore(0);

        try {
            const endpoint =
                challenge.kind === "symbols" ? "/api/symbols" : `/api/words?num=${challenge.count}`;
            let nextWords: PromptItem[];
            if (challenge.kind === "symbols") {
                const data = await fetch(endpoint).then((response) => safeJson<string[]>(response));
                nextWords = data.map((symbol) => ({ word: symbol }));
            } else {
                nextWords = await fetch(endpoint).then((response) => safeJson<PromptItem[]>(response));
            }
            if (requestId !== challengeRequestId.current) return;
            setWords(nextWords);
            setChallengeStatus(nextWords.length ? "ready" : "empty");
        } catch (error) {
            if (requestId !== challengeRequestId.current) return;
            console.error("Failed to fetch challenge:", error);
            setChallengeStatus("error");
        }
    };

    useEffect(() => {
        const raw = localStorage.getItem("player");
        if (!raw) {
            return;
        }

        try {
            const savedPlayer = JSON.parse(raw) as Player;
            setPlayer({
                uuid: savedPlayer.uuid || uuidv4(),
                name: savedPlayer.name || "",
                score: Number.isFinite(savedPlayer.score) ? savedPlayer.score : 0,
            });
            setNameInput(savedPlayer.name || "");
        } catch {
            localStorage.removeItem("player");
        }
    }, []);

    useEffect(() => {
        fetchChallenge(activeChallenge);
    }, [activeChallenge]);

    const leaderboardColumns: TableColumn<Record<string, unknown>>[] = [
        {
            title: "排名",
            width: 80,
            align: "center",
            render: (_, __, index) => ["第一", "第二", "第三"][index] ?? `${index + 1}`,
        },
        {
            title: "岛民",
            dataIndex: "name",
            render: (value, record) => {
                const fullName = String(value || "神秘小朋友").trim() || "神秘小朋友";
                const isCurrentPlayer = record.uuid === player.uuid;
                return (
                    <span className="leaderboard-player" title={isCurrentPlayer ? `${fullName} (我)` : fullName}>
                        <Avatar size="small" className="leaderboard-avatar">{fullName.slice(0, 1)}</Avatar>
                        <span className="leaderboard-name">{formatPlayerName(fullName)}</span>
                        {isCurrentPlayer ? <span className="leaderboard-me">(我)</span> : null}
                    </span>
                );
            },
        },
        {
            title: "星星",
            dataIndex: "score",
            align: "right",
            render: (value) => `${value}`,
        },
    ];

    const handleModeChange = (key: string) => {
        setChallengeStatus("loading");
        setMode(key as ChallengeMode);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setInputValue(value);
        setHasInputError(Boolean(currentWord) && value.split("").some((char, index) => char !== currentWord[index]));
    };

    const completeRound = (nextSubmittedWords: string[]) => {
        const score = nextSubmittedWords.filter((word, index) => word === words[index]?.word).length;
        setRoundScore(score);
        setResultOpen(true);
        Notification.success({
            message: "闯关完成!",
            description: `这一局收集了 ${score} 颗星星。`,
            position: "topRight",
        });
    };

    const submitCurrentWord = () => {
        const trimmedValue = inputValue.trim();
        if (!trimmedValue || !currentWord) {
            return;
        }

        const nextSubmittedWords = [...submittedWords, trimmedValue];
        setSubmittedWords(nextSubmittedWords);
        setInputValue("");
        setHasInputError(false);

        if (nextSubmittedWords.length >= words.length) {
            completeRound(nextSubmittedWords);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== " ") {
            return;
        }

        event.preventDefault();
        submitCurrentWord();
    };

    const saveScore = async (nextPlayer: Player) => {
        const response = await fetch("/api/score", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nextPlayer),
        });
        await safeJson<{ status: string; msg: string }>(response);
    };

    const handleResultOk = async () => {
        const finalName = (player.name || nameInput).trim();
        if (!finalName) {
            Notification.warning({
                message: "先给小岛取个名字吧",
                description: "排行榜需要知道这是谁的星星。",
                position: "topRight",
            });
            return;
        }

        const nextPlayer: Player = {
            ...player,
            name: finalName,
            score: player.score + roundScore,
        };

        setPlayer(nextPlayer);
        localStorage.setItem("player", JSON.stringify(nextPlayer));
        setResultOpen(false);
        fetchChallenge(activeChallenge);

        try {
            await saveScore(nextPlayer);
            Notification.success({
                message: "星星已经存进排行榜",
                position: "topRight",
            });
        } catch (error) {
            console.error("Failed to save score:", error);
            Notification.error({
                message: "分数没有存成功",
                description: "本地星星已保存，稍后可以再挑战一次。",
                position: "topRight",
            });
        }
    };

    const openLeaderboard = () => {
        setLeaderboardOpen(true);
        fetchLeaderboard();
    };

    const challengePanel = (
        <div className="challenge-panel">
            <div className="challenge-header">
                <div>
                    <Title size="middle" color={activeChallenge.color}>
                        {activeChallenge.title}
                    </Title>
                </div>
                <Tooltip variant="island" title="加油，攒更多星星吧！" placement="top">
                    <span className="wallet-tooltip-target">
                        <span className="star-balance" aria-label={`累计 ${player.score} 颗星星`}>
                            <StarIcon size={24} aria-hidden="true" />
                            <span>{player.score}</span>
                        </span>
                    </span>
                </Tooltip>
            </div>

            <div className="score-row">
                <Tag color="app-blue" variant="outlined">
                    本局 {liveScore}
                </Tag>
                <Tag color="app-green" variant="outlined">
                    已完成 {submittedWords.length}/{words.length || activeChallenge.count}
                </Tag>
                <Tag color={challengeHasError ? "app-red" : "app-yellow"} variant={challengeHasError ? "solid" : "outlined"}>
                    {challengeHint}
                </Tag>
            </div>

            <Progress
                percent={progressPercent}
                size="large"
                wave={mode === "beach"}
                aria-label="本局进度"
                infoFormat={() => `${submittedWords.length}/${words.length || activeChallenge.count}`}
            />

            <div className="word-cloud" aria-live="polite">
                {challengeStatus === "loading" ? (
                    <span className="word word--pending">正在铺好小路...</span>
                ) : challengeStatus === "error" || challengeStatus === "empty" ? (
                    <NoData
                        className="challenge-empty"
                        size="small"
                        title={challengeStatus === "error" ? "关卡暂时打不开" : "这条小路暂时没有词"}
                        description={challengeStatus === "error" ? "请检查连接后重试。" : "再取一组词试试吧。"}
                        extra={<Button type="primary" onClick={() => fetchChallenge(activeChallenge)}>重试获取</Button>}
                    />
                ) : (
                    words.map((word, index) => {
                        const state =
                            index === currentWordIndex
                                ? "current"
                                : index > currentWordIndex
                                    ? "pending"
                                    : submittedWords[index] === word.word
                                        ? "correct"
                                        : "wrong";

                        const wordNode = (
                            <span className={`word word--${state}`}>
                                {word.word}
                            </span>
                        );

                        return (
                            <span className="word-wrap" key={`${word.word}-${index}`}>
                                {word.explanation ? (
                                    <Tooltip variant="island" title={word.explanation}>
                                        {wordNode}
                                    </Tooltip>
                                ) : (
                                    wordNode
                                )}
                            </span>
                        );
                    })
                )}
            </div>

            <div className="typing-row">
                <Input
                    allowClear
                    shadow
                    size="large"
                    status={hasInputError ? "error" : undefined}
                    value={inputValue}
                    disabled={!currentWord}
                    placeholder={currentWord || (challengeStatus === "loading" ? "正在加载..." : "请先获取词语")}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onClear={() => {
                        setInputValue("");
                        setHasInputError(false);
                    }}
                />
                <Button type="primary" size="large" onClick={submitCurrentWord} disabled={!currentWord}>
                    收集
                </Button>
                {challengeStatus === "ready" ? (
                    <Button type="primary" size="large" onClick={() => fetchChallenge(activeChallenge)}>
                        换一局
                    </Button>
                ) : null}
            </div>
        </div>
    );

    const tabs: TabItem[] = challenges.map((challenge) => ({
        key: challenge.key,
        label: challenge.label,
        children: challengePanel,
    }));

    return (
        <main className="app-shell">
            <section className="hero">
                <div className="hero__copy">
                    <Title size="large" color="app-yellow">
                        动物岛打字冒险
                    </Title>
                </div>
                <div className="hero__actions">
                    <div className="hero__buttons">
                        <Button type="primary" icon={<MapIcon size={22} aria-hidden="true" />} onClick={() => setHelpOpen(true)}>
                            锦囊
                        </Button>
                        <Button type="primary" icon={<ScoreboardIcon size={22} aria-hidden="true" />} onClick={openLeaderboard}>
                            排行榜
                        </Button>
                    </div>
                </div>
            </section>

            <section className="game-board challenge-card">
                <Tabs items={tabs} activeKey={mode} onChange={handleModeChange} />
            </section>

            <div className="app-footer" aria-hidden="true" />

            <Drawer
                open={helpOpen}
                title="锦囊"
                placement="right"
                width="min(92vw, 420px)"
                onClose={() => setHelpOpen(false)}
                footer={
                    <Button type="primary" onClick={() => setHelpOpen(false)}>
                        知道啦
                    </Button>
                }
            >
                <div className="help-panel">
                    <Collapse
                        question="这是做什么的?"
                        answer={<div className="help-answer">这是一个打字闯关小游戏。选择一条小路，照着高亮单词输入，完成后收集星星。</div>}
                    />
                    <Collapse
                        question="这个要怎么玩?"
                        answer={<div className="help-answer">输入当前高亮词，按空格或点“收集”提交。每提交一次会前进到下一个词。</div>}
                    />
                    <Collapse
                        question="哪里算输入错了?"
                        answer={<div className="help-answer">输入框会即时检查字母。如果出现“有个字母跑偏了”，说明当前输入和目标词不一致。</div>}
                    />
                    <Collapse
                        question="星星和排行榜怎么算?"
                        answer={<div className="help-answer">一局结束后，打对几个词就得到几颗星星。收下星星后会提交到排行榜。</div>}
                    />
                    <Collapse
                        question="有关于词汇和游戏的建议?"
                        answer={<div className="help-answer">当前词汇为 Python 与 AI 相关词汇，如有建议请联系西瓜老师，欢迎你向他提出你的想法。</div>}
                    />
                </div>
            </Drawer>

            <Modal
                open={resultOpen}
                title="挑战完成"
                width={520}
                maskClosable={false}
                typewriter={false}
                onClose={() => undefined}
                footer={
                    <Button type="primary" size="large" onClick={handleResultOk}>
                        收下星星
                    </Button>
                }
            >
                <div className="result-panel">
                    <TrophyIcon size={88} aria-hidden="true" />
                    <CountUp start={0} end={roundScore} isCounting={resultOpen} duration={1.1} variant="island" size="large" prefix="本局得到 " suffix=" 颗星星" celebrate />
                    <p>累计将达到 {totalAfterRound} 颗星星。</p>
                    {!player.name ? (
                        <Input
                            size="large"
                            shadow
                            allowClear
                            placeholder="输入你的岛民名字"
                            value={nameInput}
                            onChange={(event) => setNameInput(event.target.value)}
                        />
                    ) : null}
                </div>
            </Modal>

            <Drawer
                open={leaderboardOpen}
                title="星星排行榜"
                placement="right"
                width="min(94vw, 520px)"
                onClose={() => setLeaderboardOpen(false)}
                footer={
                    <Button type="primary" onClick={() => setLeaderboardOpen(false)}>
                        回到小岛
                    </Button>
                }
            >
                {leaderboardStatus === "loading" || leaderboardStatus === "idle" ? (
                    <div className="leaderboard-loading" role="status" aria-label="排行榜加载中">
                        <Skeleton variant="paragraph" rows={5} active />
                    </div>
                ) : leaderboardStatus === "error" ? (
                    <NoData
                        title="排行榜暂时打不开"
                        description="请检查连接后重试。"
                        extra={<Button type="primary" onClick={fetchLeaderboard}>重试加载</Button>}
                    />
                ) : leaderboard.length === 0 ? (
                    <NoData title="还没有小岛成绩" description="完成一局后，你的星星会出现在这里。" />
                ) : (
                    <Table
                        columns={leaderboardColumns}
                        dataSource={leaderboard as Record<string, unknown>[]}
                        rowKey={(record) => String(record.uuid)}
                        scroll={{ y: 560 }}
                    />
                )}
            </Drawer>
        </main>
    );
}
