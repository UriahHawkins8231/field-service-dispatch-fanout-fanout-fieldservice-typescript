import assert from "node:assert/strict";
import test from "node:test";
import { dispatchWorkOrder, type DispatchGateway } from "../src/dispatch_work_order.js";

test("fans out only to opted-in subscribers before scheduling technician follow-up", async () => {
  const published: Array<{ payload: unknown; key: string }> = [];
  const scheduled: Array<{ cronExpr: string; task: string; key: string }> = [];
  const gateway: DispatchGateway = {
    async publish(payload, key) {
      published.push({ payload, key });
    },
    async schedule(cronExpr, task, key) {
      scheduled.push({ cronExpr, task, key });
      return { job_id: "job-follow-up-7" };
    },
  };

  const result = await dispatchWorkOrder(
    {
      workOrderId: "wo-7",
      dispatchStatus: "assigned",
      technician: { id: "tech-2", name: "Sam Rivera" },
      photos: [{ photoId: "p-1", objectKey: "orders/wo-7/panel.jpg", caption: "Damaged panel" }],
      subscribers: [
        { subscriberId: "owner", channel: "email", notificationsEnabled: true },
        { subscriberId: "tenant", channel: "sms", notificationsEnabled: false },
        { subscriberId: "dispatcher", channel: "push", notificationsEnabled: true },
      ],
      followUp: {
        cronExpr: "0 16 * * *",
        taskUrl: "https://service.example.com/follow-up",
      },
    },
    gateway,
  );

  assert.deepEqual(result.notifiedSubscriberIds, ["owner", "dispatcher"]);
  assert.equal(published.length, 2);
  assert.deepEqual(
    published.map(({ key }) => key),
    ["dispatch:wo-7:assigned:owner", "dispatch:wo-7:assigned:dispatcher"],
  );
  assert.equal(scheduled.length, 1);
  assert.match(scheduled[0].task, /workOrderId=wo-7/);
  assert.match(scheduled[0].task, /technicianId=tech-2/);
  assert.equal(result.followUpJobId, "job-follow-up-7");
});
