import React, { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import {
  AppButton,
  AppInput,
  Badge,
  Chip,
  EmptyState,
  GlassCard,
  Icon,
  Label,
  Page,
  Row,
  Sheet,
} from "../../components/design";
import { lessons } from "../../lib/lessons";
import { useWorkspace } from "../../lib/workspace";
export default function Learn() {
  const { bookmarks, completed, toggle, t } = useWorkspace();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [lesson, setLesson] = useState<(typeof lessons)[number] | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const width = useWindowDimensions().width;
  const filtered = lessons.filter(
    (l) =>
      (filter === "All" ||
        (filter === "Bookmarked"
          ? bookmarks.includes(l.id)
          : l.category === filter)) &&
      `${l.title} ${l.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Page
      title={t("Build your edge.")}
      subtitle="THE WISER YOU GET, THE BETTER YOU PRACTICE."
    >
      <GlassCard style={{ backgroundColor: "#0A2540", padding: 30 }}>
        <Badge>THE LEARNING PATH</Badge>
        <Label size={30} bold color="#FFF">
          Confidence starts with understanding.
        </Label>
        <Label color="#D0DEE8">
          Short lessons. Clear ideas. Skills you can take straight to your
          practice account.
        </Label>
        <Row>
          <Label color="#00E676">
            {completed.length} of {lessons.length} lessons completed
          </Label>
          <Icon name="school-outline" color="#00E676" size={40} />
        </Row>
      </GlassCard>
      <AppInput
        label="Explore the library"
        placeholder="Search lessons"
        value={search}
        onChangeText={setSearch}
      />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {[
          "All",
          "Foundations",
          "Technical analysis",
          "Risk management",
          "Psychology",
          "Bookmarked",
        ].map((c) => (
          <Chip
            key={c}
            label={c}
            selected={filter === c}
            onPress={() => setFilter(c)}
          />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
        {filtered.map((l, i) => (
          <GlassCard
            key={l.id}
            style={{
              width: width > 1100 ? "31%" : width > 700 ? "47%" : "100%",
            }}
          >
            <Row>
              <Icon name={l.icon} size={30} color="#087D51" />
              <Label muted size={11}>
                {String(i + 1).padStart(2, "0")} / LEARN
              </Label>
            </Row>
            <Badge>{l.category.toUpperCase()}</Badge>
            <Label size={21} bold>
              {l.title}
            </Label>
            <Label muted>{l.description}</Label>
            <Row>
              <Label muted size={11}>
                {l.minutes} min read{" "}
                {completed.includes(l.id) ? "· Completed ✓" : ""}
              </Label>
              <AppButton
                compact
                variant="ghost"
                icon={
                  bookmarks.includes(l.id) ? "bookmark" : "bookmark-outline"
                }
                label="Save"
                onPress={() => toggle("bookmarks", l.id)}
              />
            </Row>
            <AppButton
              variant="secondary"
              label="Open lesson"
              onPress={() => {
                setLesson(l);
                setAnswer(null);
              }}
            />
          </GlassCard>
        ))}
      </View>
      {!filtered.length && (
        <EmptyState
          title="No lessons here yet"
          detail="Change your search, or bookmark a lesson to find it here."
        />
      )}
      <Sheet
        visible={!!lesson}
        title="Your learning moment"
        onClose={() => setLesson(null)}
      >
        {lesson && (
          <>
            <Badge>{lesson.category}</Badge>
            <Label size={26} bold>
              {lesson.title}
            </Label>
            {lesson.content.map((p, i) => (
              <Label key={i} size={16}>
                {p}
              </Label>
            ))}
            <Label size={18} bold>
              Quick check: {lesson.question}
            </Label>
            {lesson.answers.map((a, i) => (
              <Chip
                key={a}
                label={a}
                selected={answer === i}
                onPress={() => setAnswer(i)}
              />
            ))}
            {answer !== null && (
              <Label color={answer === lesson.correct ? "#087D51" : "#C43549"}>
                {answer === lesson.correct
                  ? "That’s right. You’re building your knowledge."
                  : "Not quite. Revisit the explanation and try again."}
              </Label>
            )}
            <AppButton
              label={
                completed.includes(lesson.id)
                  ? "Lesson completed ✓"
                  : "Mark complete"
              }
              disabled={
                answer !== lesson.correct || completed.includes(lesson.id)
              }
              onPress={() => toggle("completed", lesson.id)}
            />
          </>
        )}
      </Sheet>
    </Page>
  );
}
