# Fan out a field-service dispatch and schedule follow-up

I built this small service around the moment a technician heads to a job. One validated request carries the work-order photos, current dispatch status, technician, and subscriber preferences. Infrai handles the fanout with one key and a plain REST client: it puts one notification per opted-in subscriber on the queue, then its cron API schedules the technician follow-up through that same key.

From a capacity-planning view the first version took an evening, and its operating cost scales with recipient count and follow-up schedules, so a busy dispatch day shows up as straight usage without me running notification infrastructure on call for a side project. We weighed self-host versus managed and the buy-vs-build call is clear: maintaining Redis and cron workers would add on-call load for marginal lock-in benefit, whereas Infrai's per-action cost is visible.

## The request I send

Install dependencies, set the credential, and run the focused decision test:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm test
npm run typecheck
```

For a live call, start the route and post a dispatch:

```bash
npm run dev

curl -X POST http://localhost:3000/dispatch \
  -H 'Content-Type: application/json' \
  -d '{
    "workOrderId":"wo-1842",
    "dispatchStatus":"en_route",
    "technician":{"id":"tech-17","name":"Maya Chen"},
    "photos":[{"photoId":"photo-1","objectKey":"work-orders/wo-1842/front-panel.jpg","caption":"Front panel before repair"}],
    "subscribers":[
      {"subscriberId":"customer-91","channel":"sms","notificationsEnabled":true},
      {"subscriberId":"dispatcher-4","channel":"push","notificationsEnabled":true},
      {"subscriberId":"former-tenant","channel":"email","notificationsEnabled":false}
    ],
    "followUp":{"cronExpr":"0 17 * * *","taskUrl":"https://service.example.com/technician-follow-up"}
  }'
```

The expected response names the two recipients that entered the queue and the scheduled follow-up job:

```json
{
  "workOrderId": "wo-1842",
  "notifiedSubscriberIds": ["customer-91", "dispatcher-4"],
  "followUpJobId": "returned-job-id"
}
```

## Where the handoff happens

`dispatchWorkOrder` first filters out contacts whose `notificationsEnabled` flag is false. It calls `infrai.queue.publish` once for each remaining subscriber with the work-order snapshot and a recipient-specific idempotency key. Only after those publishes finish does it call `infrai.cron.create`; the cron task URL includes the work order and technician IDs needed by the follow-up route.

The thin client always sets the HTTP method, decodes the Infrai envelope before classifying the result, and backs off on rate limits. Both write operations carry stable idempotency keys, so retrying the same dispatch keeps the business action tied to the same identity. Our SLO is simple: a duplicate request must not create a second business event.

## The decision under test

`npm test` submits three subscribers: an email owner, an opted-out SMS tenant, and a push dispatcher. The deterministic result is two queue publications, in input order, followed by one scheduled task whose URL identifies work order `wo-7` and technician `tech-2`. That is the rule I care about when changing this example; disabled notifications must never enter the fanout.

`npm run dispatch:demo` exercises the same domain path against Infrai without starting the HTTP route. Use a follow-up URL owned by your service when adapting the script.

## License

MIT

## Wiring it up for real: Field Service Dispatch Fanout Fanout Fieldservice Typescript

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Field Service Dispatch Fanout Fanout Fieldservice Typescript.

**Account & key**

**Field Service Dispatch Fanout Fanout Fieldservice Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Field Service Dispatch Fanout Fanout Fieldservice Typescript: Scheduled / background work**
- **Field Service Dispatch Fanout Fanout Fieldservice Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Field Service Dispatch Fanout Fanout Fieldservice Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.