/** @jsx figma.widget.h */

import { once, showUI, emit, on } from "@create-figma-plugin/utilities";
import _ from "lodash";
import {
  expand,
  toexpand,
  expanded,
  bulbSvgSrc,
  bulbSvgNogbSrc,
  circle,
  done,
  colors,
} from "./icons";
import { Answer, Evidence, LightbulbItem, ToggleWidget } from "./types";

const { widget } = figma;
const {
  AutoLayout,
  Image,
  Rectangle,
  Text,
  useSyncedState,
  usePropertyMenu,
  useStickable,
  useStickableHost,
  useWidgetId,
  useEffect,
  Input,
  Frame,
  SVG,
} = widget;

export default function () {
  widget.register(Lightbulb);
}

const questions: { [category: string]: string } = {
  "Design Rationale": "Why is this designed this way?",
  Function: "What is the function of this?",
  Behavior: "How does this behave?",
  "Additional Context": "What else is important for this?",
  Task: "What needs to be done to this?",
  Problems: "What is wrong with this?",
};

const initAnswers = Object.keys(questions).map((c) => ({
  category: c,
  question: questions[c],
  userName: "",
  answered: false,
  answer: "",
  expanded: false,
  editAssignee: false,
  assignee: "",
  editEvidence: false,
  evidence: [],
  hasKeyword: true,
}));

function createTime() {
  const date = new Date();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const currentDate = `${day}-${month}-${year}`;
  return { num: Date.now(), str: currentDate };
}

function Lightbulb() {
  const [name, setName] = useSyncedState<string>("name", "");
  const [open, setOpen] = useSyncedState("open", true);
  const [date, setDate] = useSyncedState("date", createTime());
  const [mode, setMode] = useSyncedState<string>("mode", "Questions"); // questions or categories
  const [answers, setAnswers] = useSyncedState<Answer[]>(
    "answers",
    initAnswers
  ); // stores all answers of this widget, initial value = {}
  const [unanswerExpand, setUnanswerExpand] = useSyncedState<boolean>(
    "unanswerExpand",
    true
  );
  const [curEvidence, setCurEvidence] = useSyncedState<Evidence>(
    "curEvidence",
    { text: "", link: "" }
  );
  const widgetId = useWidgetId();

  useEffect(() => {
    if (!name) {
      if (figma.currentUser) {
        setName(figma.currentUser.name);
        // setPhotoUrl(figma.currentUser.photoUrl);
      } else {
        figma.notify("Please login to figma");
      }
    }
  });

  const updateAnswers = (category: string, newData: {}) => {
    // update the current widget answer
    console.log("updateAnswers", newData, answers);
    let newAnswers = answers;
    let index = newAnswers.findIndex((a) => a.category == category);
    newAnswers[index] = {
      ...answers[index],
      ...newData,
      ...{ userName: name },
    };
    setAnswers(newAnswers);
    console.log("newAnswers", newAnswers);

    // update the answers stored in figmaplugindata
    // console.log(figma.currentPage.getSharedPluginData("name", "lightbulbList"));
    let lightbulbList: LightbulbItem[] =
      figma.currentPage.getSharedPluginData("name", "lightbulbList") === ""
        ? []
        : JSON.parse(
            figma.currentPage.getSharedPluginData("name", "lightbulbList")
          );
    console.log("widgetId", widgetId);
    if (lightbulbList.length)
      lightbulbList = lightbulbList.filter((lb) => lb.widgetId !== widgetId); // remove the previous data
    let newLightbulb: LightbulbItem = {
      answers: answers,
      widgetId: widgetId,
      parentNode: {
        id: figma.currentPage.selection[0].parent?.id,
        name: figma.currentPage.selection[0].parent?.name,
      },
      lastEditTime: date,
      userName: name,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
    };
    lightbulbList.push(newLightbulb);
    figma.currentPage.setSharedPluginData(
      "name",
      "lightbulbList",
      JSON.stringify(lightbulbList)
    );
  };

  const items: Array<WidgetPropertyMenuItem> = [
    {
      itemType: "action",
      propertyName: "sidebar",
      tooltip: "View All",
    },
  ];
  async function onChange({
    propertyName,
  }: WidgetPropertyEvent): Promise<void> {
    await new Promise<void>(function (resolve: () => void): void {
      if (propertyName === "sidebar") {
        console.log("sidebar");
        showUI({ height: 1200, width: 300, position: { x: 800, y: 0 } });

        on("UPDATE_FOCUS", function (id: string, pageId: string): void {
          // console.log("UPDATE_FOCUS main", id);
          handleFocus(id, pageId);
          // resolve();
        });
        on("UPDATE_LIST", function (newList: LightbulbItem[], widgetId): void {
          figma.currentPage.setSharedPluginData(
            "name",
            "lightbulbList",
            JSON.stringify(newList)
          );
          console.log(
            "findWidgetNodesByWidgetId",
            widgetId,
            figma.currentPage.findOne((n) => n.id == widgetId)
          );
          figma.currentPage.findOne((n) => n.id == widgetId)?.remove();
        });

        let lightbulbList_allpages: LightbulbItem[] = [];
        for (const page of figma.root.children) {
          console.log(page.name);

          let lightbulbList: LightbulbItem[] =
            page.getSharedPluginData("name", "lightbulbList") === ""
              ? []
              : JSON.parse(page.getSharedPluginData("name", "lightbulbList"));
          console.log(lightbulbList);
          console.log("lightbulbList_allpages", lightbulbList_allpages);
          lightbulbList_allpages = lightbulbList_allpages.concat(lightbulbList);
        }

        emit("ARCHIVE", lightbulbList_allpages);

        on<ToggleWidget>("TOGGLE_WIDGET", function (hide) {
          const allWidgetNodes: any = figma.currentPage.findAll((node) => {
            return node.type === "WIDGET" && node.widgetId == "lightbulb";
          });
          allWidgetNodes.forEach((widget: WidgetNode) => {
            if (widget.locked) return;
            return (widget.visible = hide ? true : false);
          });
        });
      }
    });
  }
  usePropertyMenu(items, onChange);

  const handleFocus = (id: string, pageId: string) => {
    console.log(
      pageId,
      figma.root.findChild((d) => d.id == pageId)
    );
    const curPg = figma.root.findChild((d) => d.id == pageId);
    if (curPg != null) {
      figma.currentPage = curPg;

      const selectionNode: Array<any> = [];
      selectionNode.push(figma.getNodeById(id));
      figma.currentPage.selection = selectionNode;
      figma.viewport.scrollAndZoomIntoView(selectionNode);
    }
  };

  return (
    <AutoLayout>
      <AutoLayout
        direction="horizontal"
        height="hug-contents"
        padding={4}
        name="Widget"
        overflow="visible"
        spacing={2}
      >
        <SVG
          src={open ? bulbSvgSrc : bulbSvgNogbSrc}
          onClick={() => setOpen(!open)}
        />

        <AutoLayout
          direction="vertical"
          verticalAlignItems="start"
          height="hug-contents"
          spacing={6}
          padding={12}
          cornerRadius={8}
          width={200}
          fill="#FFF"
          stroke="#000"
          hidden={!open}
        >
          {/* tabs */}
          <AutoLayout
            direction="horizontal"
            horizontalAlignItems="center"
            verticalAlignItems="center"
            height="hug-contents"
            padding={{ top: 5, left: 8, bottom: 0, right: 8 }}
            spacing={12}
          >
            <Text
              fontFamily="Roboto"
              fontSize={12}
              fontWeight={600}
              onClick={() => setMode("Questions")}
              fill={mode == "Questions" ? "#0B339A" : "#000000"}
              textDecoration={mode == "Questions" ? "underline" : "none"}
            >
              Questions
            </Text>
            <Text
              fontFamily="Roboto"
              fontSize={12}
              fontWeight={600}
              onClick={() => setMode("Categories")}
              fill={mode == "Categories" ? "#0B339A" : "#000000"}
              textDecoration={mode == "Categories" ? "underline" : "none"}
            >
              Categories
            </Text>
          </AutoLayout>

          {/* question/categories list */}
          <AutoLayout
            direction="vertical"
            verticalAlignItems="start"
            height="hug-contents"
            spacing={10}
            padding={12}
            cornerRadius={8}
          >
            {/* when there are answers */}
            <AutoLayout direction="vertical" spacing={6}>
              {/* answered part */}
              {answers
                .filter((a) => a.answered || a.expanded)
                .map((answer, index) => (
                  <AutoLayout
                    key={index}
                    direction="vertical"
                    spacing={6}
                    padding={{ bottom: 6 }}
                  >
                    {/* expanded question/category */}
                    <AutoLayout direction="horizontal" spacing={6}>
                      <SVG
                        src={answer.expanded ? expanded : toexpand}
                        onClick={() =>
                          updateAnswers(answer.category, {
                            expanded: !answer.expanded,
                          })
                        }
                      ></SVG>
                      <SVG src={circle(colors[answer.category])}></SVG>
                      <Text fontFamily="Roboto" fontSize={10}>
                        {mode == "Questions"
                          ? answer.question
                          : answer.category}
                      </Text>
                    </AutoLayout>
                    {/* text/input */}
                    {answer.expanded ? (
                      <AutoLayout direction="vertical" spacing={6}>
                        <AutoLayout
                          direction="horizontal"
                          horizontalAlignItems="center"
                          verticalAlignItems="center"
                          height="hug-contents"
                          padding={0}
                          spacing={8}
                        >
                          <Text
                            fontFamily="Inter"
                            fontSize={8}
                            fontWeight={400}
                          >
                            {name}
                          </Text>
                          <Text fontFamily="Inter" fontSize={8} fill="#818181">
                            {date.str}
                          </Text>
                        </AutoLayout>
                        <Input
                          fontFamily="Inter"
                          fontSize={10}
                          fontWeight="normal"
                          inputFrameProps={{
                            cornerRadius: 2,
                            fill: "#FFF",
                            horizontalAlignItems: "center",
                            overflow: "visible",
                            padding: 2,
                            stroke: "#ABABAB",
                            strokeWidth: 1,
                            verticalAlignItems: "center",
                          }}
                          onTextEditEnd={(e) => {
                            let text = e.characters.trim();
                            updateAnswers(answer.category, {
                              answer: text,
                              answered: text.length ? true : false,
                              expanded: text.length ? true : false,
                            });
                            setDate(createTime());
                          }}
                          value={answer.answer}
                          width={150}
                          paragraphSpacing={5}
                        />
                        {/* assignee */}
                        {answer.assignee == "" ? (
                          answer.editAssignee ? (
                            <AutoLayout direction="vertical" spacing={3}>
                              <AutoLayout direction="horizontal" spacing={50}>
                                <Text fontFamily="Roboto" fontSize={8}>
                                  Assign to
                                </Text>
                                <Text
                                  fontFamily="Roboto"
                                  fontSize={8}
                                  onClick={() =>
                                    updateAnswers(answer.category, {
                                      editAssignee: false,
                                    })
                                  }
                                >
                                  X
                                </Text>
                              </AutoLayout>
                              <Input
                                fontFamily="Roboto"
                                fontSize={8}
                                fontWeight="normal"
                                inputFrameProps={{
                                  cornerRadius: 2,
                                  fill: "#FFF",
                                  horizontalAlignItems: "center",
                                  overflow: "visible",
                                  padding: 2,
                                  stroke: "#ABABAB",
                                  strokeWidth: 1,
                                  verticalAlignItems: "center",
                                }}
                                onTextEditEnd={(e) => {
                                  let text = e.characters.trim();
                                  updateAnswers(answer.category, {
                                    assignee: text,
                                    editAssignee: text.length,
                                  });
                                }}
                                value={answer.assignee}
                                width={150}
                                paragraphSpacing={5}
                              />
                            </AutoLayout>
                          ) : (
                            <Text
                              fontFamily="Roboto"
                              fontSize={8}
                              fontWeight={300}
                              onClick={() =>
                                updateAnswers(answer.category, {
                                  editAssignee: true,
                                })
                              }
                            >
                              + Add assignee
                            </Text>
                          )
                        ) : (
                          <AutoLayout direction="horizontal" spacing={2}>
                            <Text fontFamily="Roboto" fontSize={8}>
                              Assigned to
                            </Text>
                            <Text
                              fontFamily="Roboto"
                              fontSize={8}
                              fill="#3366CC"
                            >
                              @{answer.assignee}
                            </Text>
                            <Text
                              fontFamily="Roboto"
                              fontSize={8}
                              onClick={() =>
                                updateAnswers(answer.category, {
                                  assignee: "",
                                  editAssignee: false,
                                })
                              }
                            >
                              X
                            </Text>
                          </AutoLayout>
                        )}

                        {/* evidence or connection */}
                        <AutoLayout direction="vertical" spacing={3}>
                          {/* {answer.evidence.length > 0 ? ( */}
                          <Text
                            fontFamily="Roboto"
                            fontSize={8}
                            hidden={answer.evidence.length <= 0}
                          >
                            Evidence or connection
                          </Text>
                          {/* ) : ( */}
                          {/* <AutoLayout></AutoLayout> */}
                          {/* )} */}

                          {answer.evidence.map((evi, i) => (
                            <AutoLayout
                              key={i}
                              direction="horizontal"
                              spacing={6}
                            >
                              <AutoLayout direction="vertical" spacing={6}>
                                <Text fontFamily="Roboto" fontSize={8}>
                                  {evi.text}
                                </Text>
                                <Text
                                  fontFamily="Roboto"
                                  fontSize={8}
                                  fill="#3366CC"
                                >
                                  {evi.link}
                                </Text>
                              </AutoLayout>
                              <Text
                                fontFamily="Roboto"
                                fontSize={8}
                                onClick={() => {
                                  let newEvidence = answer.evidence;
                                  newEvidence.splice(i);
                                  console.log(
                                    answer.evidence.map((e) => e.text)
                                  );
                                  updateAnswers(answer.category, {
                                    evidence: newEvidence,
                                  });
                                }}
                              >
                                X
                              </Text>
                            </AutoLayout>
                          ))}

                          {answer.editEvidence ? (
                            <AutoLayout direction="vertical" spacing={3}>
                              <AutoLayout direction="horizontal" spacing={50}>
                                <Text fontFamily="Roboto" fontSize={8}>
                                  Evidence or connection
                                </Text>
                                <Text
                                  fontFamily="Roboto"
                                  fontSize={8}
                                  onClick={() => {
                                    updateAnswers(answer.category, {
                                      editEvidence: false,
                                    });
                                  }}
                                >
                                  X
                                </Text>
                              </AutoLayout>
                              <Text
                                fontFamily="Roboto"
                                fontSize={8}
                                fontWeight={300}
                              >
                                Text
                              </Text>
                              <Input
                                fontFamily="Roboto"
                                fontSize={8}
                                fontWeight="normal"
                                inputFrameProps={{
                                  cornerRadius: 2,
                                  fill: "#FFF",
                                  horizontalAlignItems: "center",
                                  overflow: "visible",
                                  padding: 2,
                                  stroke: "#ABABAB",
                                  strokeWidth: 1,
                                  verticalAlignItems: "center",
                                }}
                                onTextEditEnd={(e) => {
                                  let text = e.characters.trim();
                                  setCurEvidence({
                                    ...curEvidence,
                                    ...{ text: text },
                                  });
                                }}
                                value={curEvidence.text}
                                width={150}
                                paragraphSpacing={5}
                              />
                              <Text
                                fontFamily="Roboto"
                                fontSize={8}
                                fontWeight={300}
                              >
                                Link
                              </Text>
                              <Input
                                fontFamily="Roboto"
                                fontSize={8}
                                fontWeight="normal"
                                inputFrameProps={{
                                  cornerRadius: 2,
                                  fill: "#FFF",
                                  horizontalAlignItems: "center",
                                  overflow: "visible",
                                  padding: 2,
                                  stroke: "#ABABAB",
                                  strokeWidth: 1,
                                  verticalAlignItems: "center",
                                }}
                                onTextEditEnd={(e) => {
                                  let text = e.characters.trim();
                                  setCurEvidence({
                                    ...curEvidence,
                                    ...{ link: text },
                                  });
                                }}
                                value={curEvidence.link}
                                width={150}
                                paragraphSpacing={5}
                              />
                              <AutoLayout
                                onClick={() => {
                                  let newEvidence = answer.evidence;
                                  newEvidence.push(curEvidence);
                                  setCurEvidence({ text: "", link: "" });
                                  updateAnswers(answer.category, {
                                    evidence: newEvidence,
                                    editEvidence: false,
                                  });
                                }}
                              >
                                <SVG src={done}></SVG>
                              </AutoLayout>
                            </AutoLayout>
                          ) : (
                            <Text
                              fontFamily="Roboto"
                              fontSize={8}
                              fontWeight={300}
                              onClick={() =>
                                updateAnswers(answer.category, {
                                  editEvidence: true,
                                })
                              }
                            >
                              + Add evidence or connection
                            </Text>
                          )}
                        </AutoLayout>
                      </AutoLayout>
                    ) : null}
                  </AutoLayout>
                ))}
              {/* unanswered part */}
              <AutoLayout direction="vertical" spacing={8}>
                {/* unanswered title */}
                <AutoLayout
                  direction="horizontal"
                  spacing={6}
                  hidden={
                    answers.filter((a) => a.answered || a.expanded).length == 0
                  }
                >
                  <SVG
                    src={unanswerExpand ? expanded : toexpand}
                    onClick={() => setUnanswerExpand(!unanswerExpand)}
                  ></SVG>
                  <Text fontFamily="Roboto" fontSize={10}>
                    Unanswered Questions
                  </Text>
                </AutoLayout>
                {/* unanswered questions */}
                {unanswerExpand ||
                answers.filter((a) => a.answered || a.expanded).length == 0
                  ? answers
                      .filter((a) => !a.answered && !a.expanded)
                      .map((answer, i) => (
                        <AutoLayout key={i} direction="vertical" spacing={6}>
                          <AutoLayout direction="horizontal" spacing={6}>
                            <SVG
                              src={expand(colors[answer.category])}
                              onClick={() => {
                                updateAnswers(answer.category, {
                                  expanded: !answer.expanded,
                                });
                              }}
                            ></SVG>
                            <Text fontFamily="Roboto" fontSize={10}>
                              {mode == "Questions"
                                ? answer.question
                                : answer.category}
                            </Text>
                          </AutoLayout>
                        </AutoLayout>
                      ))
                  : null}
              </AutoLayout>
            </AutoLayout>
          </AutoLayout>
        </AutoLayout>
      </AutoLayout>
    </AutoLayout>
  );
}
