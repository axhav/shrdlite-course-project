///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="AStar.ts"/>

module Planner {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    export function plan(interpretations : Interpreter.Result[], currentState : WorldState) : Result[] {
        var plans : Result[] = [];
        interpretations.forEach((intprt) => {
            var plan : Result = <Result>intprt;
            plan.plan = planInterpretation(plan.intp, currentState);
            plans.push(plan);
        });
        if (plans.length) {
            return plans;
        } else {
            throw new Planner.Error("Found no plans");
        }
    }


    export interface Result extends Interpreter.Result {plan:string[];}


    export function planToString(res : Result) : string {
        return res.plan.join(", ");
    }


    export class Error implements Error {
        public name = "Planner.Error";
        constructor(public message? : string) {}
        public toString() {return this.name + ": " + this.message}
    }


    //////////////////////////////////////////////////////////////////////
    // private functions


	// state changing functions
	function moveRight(world: WorldState) : [WorldState,string]
	{
        if(world.arm == 0)
		{
            return [{stacks:world.stacks,holding:world.holding, arm:world.arm+1,objects:world.objects,examples:world.examples},"r"];
        }
        return null;
	}
	function moveLeft(world: WorldState) : [WorldState,string]
	{
        if(world.arm == world.stacks.length-1)
		{
            return [{stacks:world.stacks,holding:world.holding, arm:world.arm-1,objects:world.objects,examples:world.examples},"l"];
        }
        return null;
	}
	function pickup(world:WorldState) : [WorldState,string]
	{
        if(world.holding == null)
        {
            var arr : string[][] = world.stacks.slice();
            for (var i = 0 ; i < world.stacks.length; i++)
            {
                arr[i] = world.stacks[i].slice();
            }
            var hold = arr[world.arm].pop();
            
            return [{stacks:arr,holding:hold,arm:world.arm,objects:world.objects,examples:world.examples},"p"];
        }
        return null;
	}
	function putdown(world:WorldState) : [WorldState,string]
	{
        if(world.holding != null)
        {
            if(putdownRules(world))
            {
                var arr = world.stacks.slice();
                for (var i = 0 ; i < world.stacks.length; i++)
                {
                    arr[i] = world.stacks[i].slice();
                }
                arr[world.arm].push(world.holding);
                
                return [{stacks:arr, holding:"",arm:world.arm,objects:world.objects,examples:world.examples},"d"];
            }
            return null;
        }
        return null;
	}
    
    function putdownRules(w : WorldState) : boolean
    {
        if( w.stacks[w.arm].length !== 0)
        {
            var topObj : string = w.stacks[w.arm][w.stacks[w.arm].length-1]; 
            var topObjDef : ObjectDefinition = w.objects[topObj];
            
            var holding : string = w.holding;
            var holdingDef : ObjectDefinition = w.objects[holding];
            
            //Balls must be in boxes or on the floor, otherwise they roll away.
            if(holdingDef.form === "ball")
            {
                if(topObjDef.form !== "box")
                    return false; 
            }
            //Balls cannot support anything.
            if(topObjDef.form === "ball")
            {
                return false;
            }
            //Small objects cannot support large objects.
            if(holdingDef.size === "large")
            {
                if(topObjDef.size !== "large")
                    return false; 
            }
            //Boxes cannot contain pyramids, planks or boxes of the same size.
            if(topObjDef.form === "box")
            {
                if(holdingDef.form === "box" || holdingDef.form === "pyramid" || holdingDef.form === "plank" )
                {
                    if(topObjDef.size == holdingDef.size)
                        return false; 
                }
            }
            //Small boxes cannot be supported by small bricks or pyramids.
            if(holdingDef.form === "box" && holdingDef.size === "small")
            {
                if(topObjDef.size === "small"&&(topObjDef.form ==="brick"||topObjDef.form ==="pyramid"))
                    return false; 
            }
            //Large boxes cannot be supported by large pyramids.
            if(holdingDef.form === "box" && holdingDef.size === "large")
            {
                if(topObjDef.size === "large"&& topObjDef.form ==="pyramid")
                    return false; 
            }
        
        }
        return true;
    }
	
	function worldItteration(world: WorldState) : [WorldState,string][]
	{
        var res :[WorldState,string][] = [];
        var test : [WorldState,string][] = [moveRight(world),moveLeft(world),pickup(world),putdown(world)]
		for (var v in test)
        {
            if(test[v] !== null)
                res.push(test[v]);
        }
        
		return res;
	}
	
    function w2N(w : WorldState) : AStar.Node
    {
        var n : [string,number][] = [];
        var ws : [WorldState,string][] = worldItteration(w);
        for(var v in ws)
        {
            n[v] = [WorldFunc.world2String(ws[v]),1]
        }
        return {wState: WorldFunc.world2String(w),neighbours:n}
    }
    
    function convertToMap(w : WorldState): {[s:string]: any}
    {
        var alphabet :string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        var i :number = 0;
        var ret : {[s:string]: any} = {}
        for( var o in w.objects)
        {
            ret[alphabet[i]] = {o};
            i++;
        }
        return ret; 
    }
    
    function goalFunction (ls : Interpreter.Literal[], curr : string)
    {
        for(var i in ls)
        {
            var l : Interpreter.Literal = ls[i];
            
            var rel : string = l.rel;
            var x   : string = l.args[0];
            var y   : string = l.args[1];
            var derp : string = ""; 
            var regExp : RegExp;
            switch(rel)
            {
                case "rightof":
                    regExp = new RegExp (derp.concat("/", y ,"([a-z]*)\d([a-z]|\d)*" ,x ,"/"));
                    break;
                case "leftof":
                    regExp = new RegExp (derp.concat("/"  ,x , "([a-z]*)\d([a-z]|\d)*" ,y ,"/"));
                    break;
                case "inside":
                    regExp = new RegExp (derp.concat("/"  , y , x , "/"));
                    break;
                case "ontop":
                    regExp = new RegExp (derp.concat("/"  , y , x , "/"));
                    break;
                case "under":
                    regExp = new RegExp (derp.concat("/"  , x , "([a-z]*)" , y , "/"));
                    break;    
                case "beside":
                    regExp = new RegExp (derp.concat("/(" , x , "([a-z]*)\d([a-z]*)" , y , ")|(" , y , "([a-z]*)\d([a-z]*)" , x , ")/"));
                    break; 
                case "above":
                    regExp = new RegExp (derp.concat("/"  , y , "([a-z]*)" , x , "/"));
                    break;
            }
            if(!regExp.test(curr))
            {
                return false;
            }
        }
        return true;
    }
	
    function planInterpretation(intprt : Interpreter.Literal[][], state : WorldState) : string[] {
        // This function returns a dummy plan involving a random stack
        		
		console.log(worldItteration(state));
        //console.log(WorldFunc.compareWorld(state,state));
        //console.log(w2N(state).neighbours);
        //console.log(convertToMap(state));
		do {
            var pickstack = getRandomInt(state.stacks.length);
        } while (state.stacks[pickstack].length == 0);
        var plan : string[] = [];

        // First move the arm to the leftmost nonempty stack
        if (pickstack < state.arm) {
            plan.push("Moving left");
            for (var i = state.arm; i > pickstack; i--) {
                plan.push("l");
            }
        } else if (pickstack > state.arm) {
            plan.push("Moving right");
            for (var i = state.arm; i < pickstack; i++) {
                plan.push("r");
            }
        }

        // Then pick up the object
        var obj = state.stacks[pickstack][state.stacks[pickstack].length-1];
        plan.push("Picking up the " + state.objects[obj].form,
                  "p");

        if (pickstack < state.stacks.length-1) {
            // Then move to the rightmost stack
            plan.push("Moving as far right as possible");
            for (var i = pickstack; i < state.stacks.length-1; i++) {
                plan.push("r");
            }

            // Then move back
            plan.push("Moving back");
            for (var i = state.stacks.length-1; i > pickstack; i--) {
                plan.push("l");
            }
        }

        // Finally put it down again
        plan.push("Dropping the " + state.objects[obj].form,
                  "d");

        return plan;
    }


    function getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

}
