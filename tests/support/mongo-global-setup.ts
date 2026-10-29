import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

/**
 * One real single-node replica set for the whole integration run (transactions need a
 * replica set). Each test file uses its own database name (see integration-setup.ts).
 */
let replSet: MongoMemoryReplSet | null = null;

export async function setup(project: TestProject): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await replSet.waitUntilRunning();
  project.provide("mongoUri", replSet.getUri());
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
