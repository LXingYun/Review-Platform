import { AppData } from "./types";

export const seedData = (): AppData => ({
  projects: [],
  documents: [],
  reviewTasks: [],
  findings: [],
  regulations: [
    {
      id: "reg-demo-1",
      name: "《中华人民共和国招标投标法》",
      category: "演示法规",
      ruleCount: 4,
      updated: "demo",
      textPreview: "演示用法规样例，包含公开、公平、公正和不得限制潜在投标人的基础规则。",
      chunks: [
        {
          id: "reg-demo-1-chunk-1",
          order: 1,
          text: "招标投标活动应当遵循公开、公平、公正和诚实信用的原则。",
        },
        {
          id: "reg-demo-1-chunk-2",
          order: 2,
          text: "招标人不得以不合理的条件限制或者排斥潜在投标人，不得对潜在投标人实行歧视待遇。",
        },
        {
          id: "reg-demo-1-chunk-3",
          order: 3,
          text: "依法必须进行招标的项目，其招标投标活动受本法调整。",
        },
        {
          id: "reg-demo-1-chunk-4",
          order: 4,
          text: "评标活动应当依照招标文件确定的标准和方法进行。",
        },
      ],
      sections: [
        { title: "总则", rules: 2 },
        { title: "招标", rules: 1 },
        { title: "评标", rules: 1 },
      ],
    },
    {
      id: "reg-demo-2",
      name: "《中华人民共和国招标投标法实施条例》",
      category: "演示法规",
      ruleCount: 4,
      updated: "demo",
      textPreview: "演示用法规样例，包含保证金比例、资格条件和招标条件适配性的基础规则。",
      chunks: [
        {
          id: "reg-demo-2-chunk-1",
          order: 1,
          text: "招标人设定的资格、技术、商务条件应当与招标项目的具体特点和实际需要相适应。",
        },
        {
          id: "reg-demo-2-chunk-2",
          order: 2,
          text: "投标保证金不得超过招标项目估算价的百分之二。",
        },
        {
          id: "reg-demo-2-chunk-3",
          order: 3,
          text: "依法必须进行招标的项目不得通过不合理条件限制或者排斥潜在投标人。",
        },
        {
          id: "reg-demo-2-chunk-4",
          order: 4,
          text: "评标委员会应当按照招标文件规定的评标标准和方法进行评审。",
        },
      ],
      sections: [
        { title: "招标条件", rules: 2 },
        { title: "保证金", rules: 1 },
        { title: "评标", rules: 1 },
      ],
    },
    {
      id: "reg-demo-3",
      name: "《必须招标的工程项目规定》",
      category: "演示法规",
      ruleCount: 3,
      updated: "demo",
      textPreview: "演示用法规样例，包含依法必须招标项目范围和基本要求。",
      chunks: [
        {
          id: "reg-demo-3-chunk-1",
          order: 1,
          text: "全部或者部分使用国有资金投资或者国家融资的项目，达到规定规模标准的，应当进行招标。",
        },
        {
          id: "reg-demo-3-chunk-2",
          order: 2,
          text: "基础设施、公用事业等关系社会公共利益、公众安全的项目，达到规定标准的，应当进行招标。",
        },
        {
          id: "reg-demo-3-chunk-3",
          order: 3,
          text: "必须招标项目应当依法开展招标投标活动。",
        },
      ],
      sections: [
        { title: "项目范围", rules: 2 },
        { title: "基本要求", rules: 1 },
      ],
    },
  ],
});
