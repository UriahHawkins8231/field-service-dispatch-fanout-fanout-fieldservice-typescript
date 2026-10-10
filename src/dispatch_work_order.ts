import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const dispatchRequestSchema = z.object({
  workOrderId: z.string().min(1),
  dispatchStatus: z.enum(["assigned", "en_route", "on_site"]),
  technician: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  photos: z.array(
    z.object({
      photoId: z.string().min(1),
      objectKey: z.string().min(1),
      caption: z.string().min(1),
    }),
  ),
  subscribers: z.array(
    z.object({
      subscriberId: z.string().min(1),
      channel: z.enum(["sms", "email", "push"]),
      notificationsEnabled: z.boolean(),
    }),
  ),
  followUp: z.object({
    cronExpr: z.string().min(1),
    taskUrl: z.string().url(),
  }),
});

export type DispatchRequest = z.infer<typeof dispatchRequestSchema>;

export type DispatchResult = {
  workOrderId: string;
  notifiedSubscriberIds: string[];
  followUpJobId: string;
};

export type DispatchGateway = {
  publish(payload: unknown, idempotencyKey: string): Promise<unknown>;
  schedule(cronExpr: string, task: string, idempotencyKey: string): Promise<{ job_id: string }>;
};

const liveGateway: DispatchGateway = {
  publish: (payload, key) => infrai.queue.publish(payload, key),
  schedule: (cronExpr, task, key) => infrai.cron.create(cronExpr, task, key),
};

export async function dispatchWorkOrder(
  request: DispatchRequest,
  gateway: DispatchGateway = liveGateway,
): Promise<DispatchResult> {
  const recipients = request.subscribers.filter((subscriber) => subscriber.notificationsEnabled);

  await Promise.all(
    recipients.map((subscriber) =>
      gateway.publish(
        {
          event: "work_order_dispatch_updated",
          workOrderId: request.workOrderId,
          dispatchStatus: request.dispatchStatus,
          technician: request.technician,
          photos: request.photos,
          subscriber: {
            subscriberId: subscriber.subscriberId,
            channel: subscriber.channel,
          },
        },
        `dispatch:${request.workOrderId}:${request.dispatchStatus}:${subscriber.subscriberId}`,
      ),
    ),
  );

  const followUpTask = new URL(request.followUp.taskUrl);
  followUpTask.searchParams.set("workOrderId", request.workOrderId);
  followUpTask.searchParams.set("technicianId", request.technician.id);

  const scheduled = await gateway.schedule(
    request.followUp.cronExpr,
    followUpTask.toString(),
    `follow-up:${request.workOrderId}:${request.dispatchStatus}`,
  );

  return {
    workOrderId: request.workOrderId,
    notifiedSubscriberIds: recipients.map((subscriber) => subscriber.subscriberId),
    followUpJobId: scheduled.job_id,
  };
}
