package au.sutto.marketonly;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.View;

/** Scalable toolbar icons with 44dp touch targets and spoken labels. */
public final class ToolbarIcon extends View {
    public static final int MESSAGE=0, SEARCH=1, MORE=2, LOCATION=3, BACK=4, CLOSE=5;
    private final int type;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    public ToolbarIcon(Context context, int type, String label, OnClickListener action) {
        super(context); this.type=type;
        setContentDescription(label); setOnClickListener(action); setFocusable(true);
        GradientDrawable mask=new GradientDrawable(); mask.setShape(GradientDrawable.OVAL); mask.setColor(Color.WHITE);
        setBackground(new RippleDrawable(ColorStateList.valueOf(0x25FFFFFF),null,mask));
    }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.save(); float scale=Math.min(getWidth(),getHeight())/44f;
        canvas.translate((getWidth()-44*scale)/2,(getHeight()-44*scale)/2); canvas.scale(scale,scale);
        paint.setColor(0xFFE4E6EB); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2.15f);
        paint.setStrokeCap(Paint.Cap.ROUND); paint.setStrokeJoin(Paint.Join.ROUND);
        Path path=new Path();
        switch(type) {
            case SEARCH: canvas.drawCircle(20,20,10.5f,paint);canvas.drawLine(28,28,35,35,paint);break;
            case MORE:
                canvas.drawCircle(22,22,12,paint);paint.setStyle(Paint.Style.FILL);
                for(int x=16;x<=28;x+=6)canvas.drawCircle(x,22,1.5f,paint);break;
            case BACK: path.moveTo(25,11);path.lineTo(14,22);path.lineTo(25,33);canvas.drawPath(path,paint);break;
            case CLOSE: canvas.drawLine(15,15,29,29,paint);canvas.drawLine(15,29,29,15,paint);break;
            case LOCATION:
                paint.setStyle(Paint.Style.FILL);path.moveTo(22,36);path.cubicTo(18,31,11,25,11,19);
                path.cubicTo(11,5,33,5,33,19);path.cubicTo(33,25,26,31,22,36);canvas.drawPath(path,paint);
                paint.setColor(0xFF242526);canvas.drawCircle(22,19,4,paint);break;
            case MESSAGE:
                paint.setStyle(Paint.Style.FILL);canvas.drawOval(9,9,35,33,paint);
                path.moveTo(11,27);path.lineTo(11,36);path.lineTo(20,31);path.close();canvas.drawPath(path,paint);
                paint.setColor(0xFF242526);path.reset();path.moveTo(13,25);path.lineTo(21,16);path.lineTo(25,20);
                path.lineTo(31,16);path.lineTo(23,26);path.lineTo(19,22);path.close();canvas.drawPath(path,paint);break;
        }
        canvas.restore();
    }
}
