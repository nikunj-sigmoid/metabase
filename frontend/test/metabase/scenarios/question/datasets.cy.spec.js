import { restore, modal, popover, visualize } from "__support__/e2e/cypress";

describe("scenarios > datasets", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("allows to turn a question into a dataset", () => {
    cy.request("PUT", "/api/card/1", { name: "Orders Dataset" });
    cy.visit("/question/1");

    turnIntoDataset();
    assertIsDataset();

    cy.findByTestId("qb-header-action-panel").within(() => {
      cy.findByText("Filter").click();
    });
    selectDimensionOptionFromSidebar("Discount");
    cy.findByText("Equal to").click();
    selectFromDropdown("Not empty");
    cy.button("Add filter").click();

    assertQuestionIsBasedOnDataset({
      dataset: "Orders Dataset",
      collection: "Our analytics",
      table: "Orders",
    });

    saveQuestionBasedOnDataset({ datasetId: 1, name: "Q1" });

    assertQuestionIsBasedOnDataset({
      questionName: "Q1",
      dataset: "Orders Dataset",
      collection: "Our analytics",
      table: "Orders",
    });

    cy.findAllByText("Our analytics")
      .first()
      .click();
    getCollectionItemRow("Orders Dataset").within(() => {
      cy.icon("dataset");
    });
    getCollectionItemRow("Q1").within(() => {
      cy.icon("table");
    });

    cy.url().should("not.include", "/question/1");
  });

  it("changes dataset's display to table", () => {
    cy.visit("/question/3");

    cy.get(".LineAreaBarChart");
    cy.get(".TableInteractive").should("not.exist");

    turnIntoDataset();

    cy.get(".TableInteractive");
    cy.get(".LineAreaBarChart").should("not.exist");
  });

  it("allows to undo turning a question into a dataset", () => {
    cy.visit("/question/3");
    cy.get(".LineAreaBarChart");

    turnIntoDataset();
    cy.findByText("This is a dataset now.");
    cy.findByText("Undo").click();

    cy.get(".LineAreaBarChart");
    assertIsQuestion();
  });

  it("allows to turn a dataset back into a saved question", () => {
    cy.request("PUT", "/api/card/1", { dataset: true });
    cy.intercept("PUT", "/api/card/1").as("cardUpdate");
    cy.visit("/question/1");

    openDetailsSidebar();
    cy.findByText("Turn back into a saved question").click();
    cy.wait("@cardUpdate");

    cy.findByText("This is a question now.");
    assertIsQuestion();

    cy.findByText("Undo").click();
    cy.wait("@cardUpdate");
    assertIsDataset();
  });

  describe("data picker", () => {
    beforeEach(() => {
      cy.intercept("GET", "/api/search").as("search");
      cy.request("PUT", "/api/card/1", { dataset: true });
    });

    it("transforms the data picker", () => {
      cy.visit("/question/new");
      cy.findByText("Custom question").click();

      popover().within(() => {
        testDataPickerSearch({
          inputPlaceholderText: "Search for some data…",
          query: "Ord",
          datasets: true,
          cards: true,
          tables: true,
        });

        cy.findByText("Datasets").click();
        cy.findByTestId("select-list").within(() => {
          cy.findByText("Orders");
          cy.findByText("Orders, Count").should("not.exist");
        });
        testDataPickerSearch({
          inputPlaceholderText: "Search for a model…",
          query: "Ord",
          datasets: true,
        });
        cy.icon("chevronleft").click();

        cy.findByText("Saved Questions").click();
        cy.findByTestId("select-list").within(() => {
          cy.findByText("Orders, Count");
          cy.findByText("Orders").should("not.exist");
        });
        testDataPickerSearch({
          inputPlaceholderText: "Search for a question…",
          query: "Ord",
          cards: true,
        });
        cy.icon("chevronleft").click();

        cy.findByText("Raw Data").click();
        cy.findByText("Sample Dataset");
        cy.findByText("Saved Questions").should("not.exist");
        testDataPickerSearch({
          inputPlaceholderText: "Search for a table…",
          query: "Ord",
          tables: true,
        });
      });
    });

    it("allows to create a question based on a dataset", () => {
      cy.visit("/question/new");
      cy.findByText("Custom question").click();

      popover().within(() => {
        cy.findByText("Datasets").click();
        cy.findByText("Orders").click();
      });

      joinTable("Products");
      selectFromDropdown("Product ID");
      selectFromDropdown("ID");

      cy.findByText("Add filters to narrow your answer").click();
      selectFromDropdown("Products");
      selectFromDropdown("Price");
      selectFromDropdown("Equal to");
      selectFromDropdown("Less than");
      cy.findByPlaceholderText("Enter a number").type("50");
      cy.button("Add filter").click();

      cy.findByText("Pick the metric you want to see").click();
      selectFromDropdown("Count of rows");

      cy.findByText("Pick a column to group by").click();
      selectFromDropdown("Created At");

      visualize();
      cy.get(".LineAreaBarChart");
      cy.findByText("Save").click();

      modal().within(() => {
        cy.button("Save").click();
      });

      cy.url().should("match", /\/question\/\d+-[a-z0-9-]*$/);
    });
  });

  describe("simple mode", () => {
    beforeEach(() => {
      cy.request("PUT", "/api/card/1", {
        name: "Orders Dataset",
        dataset: true,
      });
    });

    it("can create a question by filtering and summarizing a dataset", () => {
      cy.visit("/question/1");

      cy.findByTestId("qb-header-action-panel").within(() => {
        cy.findByText("Filter").click();
      });
      selectDimensionOptionFromSidebar("Discount");
      cy.findByText("Equal to").click();
      selectFromDropdown("Not empty");
      cy.button("Add filter").click();

      assertQuestionIsBasedOnDataset({
        dataset: "Orders Dataset",
        collection: "Our analytics",
        table: "Orders",
      });

      cy.findByTestId("qb-header-action-panel").within(() => {
        cy.findByText("Summarize").click();
      });
      selectDimensionOptionFromSidebar("Created At");
      cy.button("Done").click();

      assertQuestionIsBasedOnDataset({
        questionName: "Count by Created At: Month",
        dataset: "Orders Dataset",
        collection: "Our analytics",
        table: "Orders",
      });

      saveQuestionBasedOnDataset({ datasetId: 1, name: "Q1" });

      assertQuestionIsBasedOnDataset({
        questionName: "Q1",
        dataset: "Orders Dataset",
        collection: "Our analytics",
        table: "Orders",
      });

      cy.url().should("not.include", "/question/1");
    });

    it("can create a question using table click actions", () => {
      cy.visit("/question/1");

      cy.findByText("Subtotal").click();
      selectFromDropdown("Sum over time");

      assertQuestionIsBasedOnDataset({
        questionName: "Sum of Subtotal by Created At: Month",
        dataset: "Orders Dataset",
        collection: "Our analytics",
        table: "Orders",
      });

      saveQuestionBasedOnDataset({ datasetId: 1, name: "Q1" });

      assertQuestionIsBasedOnDataset({
        questionName: "Q1",
        dataset: "Orders Dataset",
        collection: "Our analytics",
        table: "Orders",
      });

      cy.url().should("not.include", "/question/1");
    });
  });
});

function assertQuestionIsBasedOnDataset({
  questionName,
  collection,
  dataset,
  table,
}) {
  if (questionName) {
    cy.findByText(questionName);
  }

  // Asserts shows dataset and its collection names
  // instead of db + table
  cy.findAllByText(collection);
  cy.findByText(dataset);

  cy.findByText("Sample Dataset").should("not.exist");
  cy.findByText(table).should("not.exist");
}

function assertCreatedNestedQuery(datasetId) {
  cy.wait("@createCard").then(({ request }) => {
    expect(request.body.dataset_query.query["source-table"]).to.equal(
      `card__${datasetId}`,
    );
  });
}

function saveQuestionBasedOnDataset({ datasetId, name }) {
  cy.intercept("POST", "/api/card").as("createCard");

  cy.findByText("Save").click();

  modal().within(() => {
    cy.findByText(/Replace original question/i).should("not.exist");
    if (name) {
      cy.findByLabelText("Name")
        .clear()
        .type(name);
    }
    cy.findByText("Save").click();
  });

  assertCreatedNestedQuery(datasetId);

  modal()
    .findByText("Not now")
    .click();
}

function selectDimensionOptionFromSidebar(name) {
  cy.get("[data-testid=dimension-list-item]")
    .contains(name)
    .click();
}

function openDetailsSidebar() {
  cy.findByTestId("saved-question-header-button").click();
}

function getDetailsSidebarActions(iconName) {
  return cy.findByTestId("question-action-buttons");
}

// Requires dataset details sidebar to be open
function assertIsDataset() {
  getDetailsSidebarActions().within(() => {
    cy.icon("dataset").should("not.exist");
  });
  cy.findByText("Dataset management");
}

// Requires question details sidebar to be open
function assertIsQuestion() {
  getDetailsSidebarActions().within(() => {
    cy.icon("dataset");
  });
  cy.findByText("Dataset management").should("not.exist");
}

function turnIntoDataset() {
  openDetailsSidebar();
  getDetailsSidebarActions().within(() => {
    cy.icon("dataset").click();
  });
  modal().within(() => {
    cy.button("Turn this into a dataset").click();
  });
}

function getCollectionItemRow(itemName) {
  return cy.findByText(itemName).closest("tr");
}

function selectFromDropdown(option, clickOpts) {
  popover()
    .findByText(option)
    .click(clickOpts);
}

function joinTable(table) {
  cy.icon("join_left_outer").click();
  selectFromDropdown(table);
}

function testDataPickerSearch({
  inputPlaceholderText,
  query,
  datasets = false,
  cards = false,
  tables = false,
} = {}) {
  cy.findByPlaceholderText(inputPlaceholderText).type(query);
  cy.wait("@search");

  cy.findAllByText(/Dataset in/i).should(datasets ? "exist" : "not.exist");
  cy.findAllByText(/Saved question in/i).should(cards ? "exist" : "not.exist");
  cy.findAllByText(/Table in/i).should(tables ? "exist" : "not.exist");

  cy.icon("close").click();
}
