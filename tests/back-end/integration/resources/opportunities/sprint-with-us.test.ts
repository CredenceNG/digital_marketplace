import { app } from "back-end/index";
import { clearTestDatabase } from "tests/back-end/integration/helpers";
import {
  insertUserWithActiveSession,
  requestWithCookie
} from "tests/back-end/integration/helpers/user";
import { connection } from "tests/back-end/setup-server.jest";
import { UserType } from "shared/lib/resources/user";
import { agent } from "supertest";
import { buildCreateUserParams } from "tests/utils/generate/user";
import { buildSWUOpportunity } from "tests/utils/generate/opportunities/sprint-with-us";
import {
  CreateRequestBody,
  SWUOpportunityStatus
} from "shared/lib/resources/opportunity/sprint-with-us";
import { omit, pick } from "lodash";
import { getISODateString } from "shared/lib";

async function setup() {
  const [testUser, testUserSession] = await insertUserWithActiveSession(
    buildCreateUserParams({ type: UserType.Government }),
    connection
  );
  const [testAdmin, testAdminSession] = await insertUserWithActiveSession(
    buildCreateUserParams({ type: UserType.Admin }),
    connection
  );
  const appAgent = agent(app);
  return { testUser, testUserSession, testAdmin, testAdminSession, appAgent };
}

afterEach(async () => {
  await clearTestDatabase(connection);
});

test("sprint-with-us opportunity crud", async () => {
  const { testUser, testUserSession, appAgent } = await setup();

  const opportunity = buildSWUOpportunity();
  const body: CreateRequestBody = {
    ...pick(opportunity, [
      "title",
      "teaser",
      "remoteOk",
      "remoteDesc",
      "location",
      "totalMaxBudget",
      "minTeamMembers",
      "mandatorySkills",
      "optionalSkills",
      "description",
      "questionsWeight",
      "codeChallengeWeight",
      "scenarioWeight",
      "priceWeight"
    ]),
    proposalDeadline: getISODateString(opportunity, "proposalDeadline"),
    assignmentDate: getISODateString(opportunity, "assignmentDate"),
    implementationPhase: {
      startDate: getISODateString(opportunity.implementationPhase, "startDate"),
      completionDate: getISODateString(
        opportunity.implementationPhase,
        "completionDate"
      ),
      maxBudget: opportunity.implementationPhase.maxBudget,
      requiredCapabilities:
        opportunity.implementationPhase.requiredCapabilities.map(
          ({ capability, fullTime }) => ({ capability, fullTime })
        )
    },
    attachments: [],
    status: SWUOpportunityStatus.Draft,
    teamQuestions: opportunity.teamQuestions.map(
      ({ createdAt, createdBy, ...restOfQuestion }) => restOfQuestion
    )
  };

  const createRequest = appAgent
    .post("/api/opportunities/sprint-with-us")
    .send(body);

  const createResult = await requestWithCookie(createRequest, testUserSession);

  expect(createResult.status).toEqual(201);
  expect(createResult.body).toMatchObject({
    ...omit(createResult.body, ["minTeamMembers"]),
    // Express' res.json omits falsy values.
    ...(body.minTeamMembers ? { minTeamMembers: body.minTeamMembers } : {}),
    implementationPhase: {
      ...body.implementationPhase,
      // Capabilities may be out of order
      requiredCapabilities: expect.arrayContaining(
        body.implementationPhase.requiredCapabilities.map((capability) =>
          expect.objectContaining(capability)
        )
      )
    },
    createdBy: { id: testUser.id }
  });
});
